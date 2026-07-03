//! TruthStake — staked commit-reveal resolution for unsignable markets.
//!
//! The hole in "trust the market, not an authority" is the resolver: if one
//! party (or one LLM jury we run) decides the outcome, we've just re-created a
//! trusted signer. TruthStake fixes that. Anyone can stake sUSD on the outcome
//! they assert, sealed so nobody can copy a vote, revealed after close, and the
//! stake-weighted majority wins. Wrong stakers are slashed to the winners.
//! Truth-telling now has skin in the game at the resolution layer, on-chain and
//! accountable — the LLM jury becomes just one more staker, not the authority.
//!
//! Lifecycle:  commit (sealed) → reveal → finalize (drives market.resolve) → claim.

use crate::market::Cep18LikeContractRef;
use odra::casper_types::bytesrepr::Bytes;
use odra::casper_types::U256;
use odra::prelude::*;
use odra::ContractRef;

#[odra::odra_error]
pub enum StakeError {
    CommitClosed = 30,
    RevealNotOpen = 31,
    RevealClosed = 32,
    AlreadyCommitted = 33,
    NoCommitment = 34,
    BadReveal = 35,
    AlreadyRevealed = 36,
    NotFinalized = 37,
    AlreadyFinalized = 38,
    TooEarly = 39,
    NoReveals = 40,
    NothingToClaim = 41,
    ZeroStake = 42,
    NotConfigured = 43,
    NotAdmin = 44,
    AlreadyBound = 45,
}

#[odra::event]
pub struct Committed {
    pub staker: Address,
    pub amount: U256,
}

#[odra::event]
pub struct Revealed {
    pub staker: Address,
    pub outcome: bool,
    pub amount: U256,
}

#[odra::event]
pub struct Finalized {
    pub market: Address,
    pub outcome: bool,
    pub winning_stake: U256,
    pub total_stake: U256,
}

#[odra::event]
pub struct StakeClaimed {
    pub staker: Address,
    pub amount: U256,
}

#[odra::module(
    events = [Committed, Revealed, Finalized, StakeClaimed],
    errors = StakeError
)]
pub struct TruthStake {
    admin: Var<Address>,
    token: Var<Address>, // sUSD
    market: Var<Address>, // the market this round resolves (bound once)
    commit_close: Var<u64>, // ms — commits accepted before this
    reveal_close: Var<u64>, // ms — reveals accepted in [commit_close, reveal_close)
    finalized: Var<bool>,
    outcome: Var<bool>,
    yes_stake: Var<U256>, // revealed YES stake
    no_stake: Var<U256>, // revealed NO stake
    total_staked: Var<U256>, // everything committed (revealed or not)
    winning_stake: Var<U256>, // revealed stake on the winning side
    commitments: Mapping<Address, Bytes>,
    stake: Mapping<Address, U256>,
    revealed: Mapping<Address, bool>,
    vote: Mapping<Address, bool>,
    claimed: Mapping<Address, bool>,
}

/// commitment = blake2b( [outcome as u8] ++ salt.to_le_bytes() )
/// computed off-chain by the staker; the salt stays secret until reveal.
fn commitment_preimage(outcome: bool, salt: u64) -> Vec<u8> {
    let mut pre = Vec::with_capacity(9);
    pre.push(if outcome { 1u8 } else { 0u8 });
    pre.extend_from_slice(&salt.to_le_bytes());
    pre
}

#[odra::module]
impl TruthStake {
    pub fn init(&mut self, token: Address, commit_close: u64, reveal_close: u64) {
        self.admin.set(self.env().caller());
        self.token.set(token);
        self.commit_close.set(commit_close);
        self.reveal_close.set(reveal_close);
        self.finalized.set(false);
        self.outcome.set(false);
        self.yes_stake.set(U256::zero());
        self.no_stake.set(U256::zero());
        self.total_staked.set(U256::zero());
        self.winning_stake.set(U256::zero());
    }

    /// Bind the market this round resolves. Deploy order breaks the circular
    /// reference: deploy stake → deploy market with resolver = stake → bind.
    /// Callable once, by the admin.
    pub fn bind_market(&mut self, market: Address) {
        if self.env().caller() != self.admin.get_or_revert_with(StakeError::NotAdmin) {
            self.env().revert(StakeError::NotAdmin);
        }
        if self.market.get().is_some() {
            self.env().revert(StakeError::AlreadyBound);
        }
        self.market.set(market);
    }

    /// Stake sUSD behind a sealed vote. commitment hides your outcome + salt.
    pub fn commit(&mut self, commitment: Bytes, amount: U256) {
        if self.env().get_block_time() >= self.commit_close.get_or_default() {
            self.env().revert(StakeError::CommitClosed);
        }
        if amount.is_zero() {
            self.env().revert(StakeError::ZeroStake);
        }
        let caller = self.env().caller();
        if self.commitments.get(&caller).is_some() {
            self.env().revert(StakeError::AlreadyCommitted);
        }
        self.pull(caller, amount);
        self.commitments.set(&caller, commitment);
        self.stake.set(&caller, amount);
        self.total_staked.set(self.total_staked.get_or_default() + amount);
        self.env().emit_event(Committed { staker: caller, amount });
    }

    /// Reveal your outcome + salt. Must match your sealed commitment.
    pub fn reveal(&mut self, outcome: bool, salt: u64) {
        let now = self.env().get_block_time();
        let commit_close = self.commit_close.get_or_default();
        let reveal_close = self.reveal_close.get_or_default();
        if now < commit_close {
            self.env().revert(StakeError::RevealNotOpen);
        }
        if now >= reveal_close {
            self.env().revert(StakeError::RevealClosed);
        }
        let caller = self.env().caller();
        let stored = self
            .commitments
            .get(&caller)
            .unwrap_or_revert_with(&self.env(), StakeError::NoCommitment);
        if self.revealed.get_or_default(&caller) {
            self.env().revert(StakeError::AlreadyRevealed);
        }
        let recomputed = Bytes::from(self.env().hash(commitment_preimage(outcome, salt)).to_vec());
        if recomputed != stored {
            self.env().revert(StakeError::BadReveal);
        }
        let amount = self.stake.get_or_default(&caller);
        self.revealed.set(&caller, true);
        self.vote.set(&caller, outcome);
        if outcome {
            self.yes_stake.set(self.yes_stake.get_or_default() + amount);
        } else {
            self.no_stake.set(self.no_stake.get_or_default() + amount);
        }
        self.env().emit_event(Revealed { staker: caller, outcome, amount });
    }

    /// After the reveal window: stake-weighted majority wins and the market is
    /// resolved on-chain. Permissionless — anyone can trigger it.
    pub fn finalize(&mut self) {
        if self.finalized.get_or_default() {
            self.env().revert(StakeError::AlreadyFinalized);
        }
        if self.env().get_block_time() < self.reveal_close.get_or_default() {
            self.env().revert(StakeError::TooEarly);
        }
        let yes = self.yes_stake.get_or_default();
        let no = self.no_stake.get_or_default();
        if yes.is_zero() && no.is_zero() {
            self.env().revert(StakeError::NoReveals);
        }
        let outcome = yes > no; // tie → NO
        let winning = if outcome { yes } else { no };
        self.outcome.set(outcome);
        self.winning_stake.set(winning);
        self.finalized.set(true);

        let market = self.market.get_or_revert_with(StakeError::NotConfigured);
        crate::market::BinaryMarketContractRef::new(self.env(), market).resolve(outcome);

        self.env().emit_event(Finalized {
            market,
            outcome,
            winning_stake: winning,
            total_stake: self.total_staked.get_or_default(),
        });
    }

    /// Winners withdraw their stake plus a proportional cut of the whole pool
    /// (losers and no-shows are slashed). payout = total_staked * my_stake / winning_stake.
    pub fn claim(&mut self) {
        if !self.finalized.get_or_default() {
            self.env().revert(StakeError::NotFinalized);
        }
        let caller = self.env().caller();
        if self.claimed.get_or_default(&caller) || !self.revealed.get_or_default(&caller) {
            self.env().revert(StakeError::NothingToClaim);
        }
        self.claimed.set(&caller, true);
        if self.vote.get_or_default(&caller) != self.outcome.get_or_default() {
            // slashed — stake stays in the pool for the winners
            self.env().emit_event(StakeClaimed { staker: caller, amount: U256::zero() });
            return;
        }
        let my = self.stake.get_or_default(&caller);
        let payout = self.total_staked.get_or_default() * my / self.winning_stake.get_or_default();
        self.push(caller, payout);
        self.env().emit_event(StakeClaimed { staker: caller, amount: payout });
    }

    // ── views ────────────────────────────────────────────────────

    pub fn is_finalized(&self) -> bool {
        self.finalized.get_or_default()
    }

    pub fn outcome(&self) -> bool {
        self.outcome.get_or_default()
    }

    pub fn tallies(&self) -> (U256, U256, U256) {
        (
            self.yes_stake.get_or_default(),
            self.no_stake.get_or_default(),
            self.total_staked.get_or_default(),
        )
    }

    pub fn stake_of(&self, staker: Address) -> U256 {
        self.stake.get_or_default(&staker)
    }

    // ── internals ────────────────────────────────────────────────

    fn pull(&mut self, from: Address, amount: U256) {
        let token = self.token.get_or_revert_with(StakeError::NotConfigured);
        Cep18LikeContractRef::new(self.env(), token).transfer_from(
            from,
            self.env().self_address(),
            amount,
        );
    }

    fn push(&mut self, to: Address, amount: U256) {
        let token = self.token.get_or_revert_with(StakeError::NotConfigured);
        Cep18LikeContractRef::new(self.env(), token).transfer(to, amount);
    }
}
