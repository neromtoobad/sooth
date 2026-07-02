//! BinaryMarket — YES/NO prediction market over a CEP-18 collateral token.
//!
//! Constant-product AMM (x*y=k) over YES/NO share reserves, 1% fee on the way in.
//! Buys only move the price; each sUSD paid in mints a share-pair into the pool,
//! then the pool swaps one side out to the buyer. price_yes = no_pool/(yes+no).
//! After close, the resolver posts the outcome once; winning shares redeem 1:1.

use odra::casper_types::U256;
use odra::prelude::*;
use odra::ContractRef;

/// minimal CEP-18 surface the market needs (sUSD / Cep18X402 both satisfy it)
#[odra::external_contract]
pub trait Cep18Like {
    fn transfer(&mut self, recipient: Address, amount: U256);
    fn transfer_from(&mut self, owner: Address, recipient: Address, amount: U256);
    fn balance_of(&self, address: Address) -> U256;
}

#[odra::odra_error]
pub enum MarketError {
    MarketClosed = 1,
    MarketNotClosed = 2,
    NotResolver = 3,
    AlreadyResolved = 4,
    NotResolved = 5,
    ZeroAmount = 6,
    ZeroOutput = 7,
    NothingToClaim = 8,
    NotAdmin = 9,
    NoLiquidity = 10,
}

#[odra::event]
pub struct Trade {
    pub trader: Address,
    pub yes: bool,
    pub amount_in: U256,
    pub shares_out: U256,
    pub p_yes_nano: u64,
}

#[odra::event]
pub struct LiquidityAdded {
    pub provider: Address,
    pub amount: U256,
}

#[odra::event]
pub struct Resolved {
    pub outcome: bool,
}

#[odra::event]
pub struct Claimed {
    pub account: Address,
    pub amount: U256,
}

const FEE_BPS: u64 = 100; // 1%
const BPS: u64 = 10_000;
const NANO: u64 = 1_000_000_000;

#[odra::module(
    factory = on,
    events = [Trade, LiquidityAdded, Resolved, Claimed],
    errors = MarketError
)]
pub struct BinaryMarket {
    question: Var<String>,
    close_ts: Var<u64>, // block-time ms
    resolver: Var<Address>,
    token: Var<Address>,
    admin: Var<Address>,
    yes_pool: Var<U256>,
    no_pool: Var<U256>,
    resolved: Var<bool>,
    outcome: Var<bool>,
    fees_accrued: Var<U256>,
    yes_shares: Mapping<Address, U256>,
    no_shares: Mapping<Address, U256>,
}

#[odra::module(factory = on)]
impl BinaryMarket {
    pub fn init(
        &mut self,
        question: String,
        close_ts: u64,
        resolver: Address,
        token: Address,
        admin: Address,
    ) {
        self.question.set(question);
        self.close_ts.set(close_ts);
        self.resolver.set(resolver);
        self.token.set(token);
        self.admin.set(admin);
        self.yes_pool.set(U256::zero());
        self.no_pool.set(U256::zero());
        self.resolved.set(false);
        self.outcome.set(false);
        self.fees_accrued.set(U256::zero());
    }

    // ── liquidity ────────────────────────────────────────────────

    pub fn add_liquidity(&mut self, amount: U256) {
        let caller = self.env().caller();
        if caller != self.admin.get_or_revert_with(MarketError::NotAdmin) {
            self.env().revert(MarketError::NotAdmin);
        }
        if amount.is_zero() {
            self.env().revert(MarketError::ZeroAmount);
        }
        self.pull_collateral(caller, amount);
        self.yes_pool.set(self.yes_pool.get_or_default() + amount);
        self.no_pool.set(self.no_pool.get_or_default() + amount);
        self.env().emit_event(LiquidityAdded {
            provider: caller,
            amount,
        });
    }

    // ── trading ──────────────────────────────────────────────────

    pub fn buy_yes(&mut self, amount_in: U256) {
        self.buy(true, amount_in);
    }

    pub fn buy_no(&mut self, amount_in: U256) {
        self.buy(false, amount_in);
    }

    // ── resolution ───────────────────────────────────────────────

    pub fn resolve(&mut self, outcome: bool) {
        let caller = self.env().caller();
        if caller != self.resolver.get_or_revert_with(MarketError::NotResolver) {
            self.env().revert(MarketError::NotResolver);
        }
        if self.env().get_block_time() < self.close_ts.get_or_default() {
            self.env().revert(MarketError::MarketNotClosed);
        }
        if self.resolved.get_or_default() {
            self.env().revert(MarketError::AlreadyResolved);
        }
        self.resolved.set(true);
        self.outcome.set(outcome);
        self.env().emit_event(Resolved { outcome });
    }

    pub fn claim(&mut self) {
        if !self.resolved.get_or_default() {
            self.env().revert(MarketError::NotResolved);
        }
        let caller = self.env().caller();
        let winning = if self.outcome.get_or_default() {
            let s = self.yes_shares.get_or_default(&caller);
            self.yes_shares.set(&caller, U256::zero());
            s
        } else {
            let s = self.no_shares.get_or_default(&caller);
            self.no_shares.set(&caller, U256::zero());
            s
        };
        if winning.is_zero() {
            self.env().revert(MarketError::NothingToClaim);
        }
        self.push_collateral(caller, winning);
        self.env().emit_event(Claimed {
            account: caller,
            amount: winning,
        });
    }

    // ── views ────────────────────────────────────────────────────

    /// probability of YES in nano units (0..=1_000_000_000)
    pub fn price_yes(&self) -> u64 {
        let yes = self.yes_pool.get_or_default();
        let no = self.no_pool.get_or_default();
        let total = yes + no;
        if total.is_zero() {
            return NANO / 2;
        }
        (no * U256::from(NANO) / total).as_u64()
    }

    pub fn question(&self) -> String {
        self.question.get_or_default()
    }

    pub fn close_ts(&self) -> u64 {
        self.close_ts.get_or_default()
    }

    pub fn pools(&self) -> (U256, U256) {
        (self.yes_pool.get_or_default(), self.no_pool.get_or_default())
    }

    pub fn is_resolved(&self) -> bool {
        self.resolved.get_or_default()
    }

    pub fn outcome(&self) -> bool {
        self.outcome.get_or_default()
    }

    pub fn fees(&self) -> U256 {
        self.fees_accrued.get_or_default()
    }

    pub fn yes_shares_of(&self, account: Address) -> U256 {
        self.yes_shares.get_or_default(&account)
    }

    pub fn no_shares_of(&self, account: Address) -> U256 {
        self.no_shares.get_or_default(&account)
    }

    // ── internals ────────────────────────────────────────────────

    fn buy(&mut self, yes: bool, amount_in: U256) {
        if amount_in.is_zero() {
            self.env().revert(MarketError::ZeroAmount);
        }
        if self.resolved.get_or_default()
            || self.env().get_block_time() >= self.close_ts.get_or_default()
        {
            self.env().revert(MarketError::MarketClosed);
        }
        let yes_pool = self.yes_pool.get_or_default();
        let no_pool = self.no_pool.get_or_default();
        if yes_pool.is_zero() || no_pool.is_zero() {
            self.env().revert(MarketError::NoLiquidity);
        }

        let caller = self.env().caller();
        self.pull_collateral(caller, amount_in);

        let fee = amount_in * U256::from(FEE_BPS) / U256::from(BPS);
        let net = amount_in - fee;
        self.fees_accrued.set(self.fees_accrued.get_or_default() + fee);

        // net collateral mints a share-pair into both reserves, then the pool
        // swaps the bought side out keeping k = yes*no constant (ceil-div in
        // the pool's favor so rounding never drains it)
        let k = yes_pool * no_pool;
        let (out, new_yes, new_no) = if yes {
            let new_no = no_pool + net;
            let kept_yes = ceil_div(k, new_no);
            let gross_yes = yes_pool + net;
            if kept_yes >= gross_yes {
                self.env().revert(MarketError::ZeroOutput);
            }
            (gross_yes - kept_yes, kept_yes, new_no)
        } else {
            let new_yes = yes_pool + net;
            let kept_no = ceil_div(k, new_yes);
            let gross_no = no_pool + net;
            if kept_no >= gross_no {
                self.env().revert(MarketError::ZeroOutput);
            }
            (gross_no - kept_no, new_yes, kept_no)
        };

        self.yes_pool.set(new_yes);
        self.no_pool.set(new_no);
        if yes {
            self.yes_shares
                .set(&caller, self.yes_shares.get_or_default(&caller) + out);
        } else {
            self.no_shares
                .set(&caller, self.no_shares.get_or_default(&caller) + out);
        }

        self.env().emit_event(Trade {
            trader: caller,
            yes,
            amount_in,
            shares_out: out,
            p_yes_nano: self.price_yes(),
        });
    }

    fn pull_collateral(&mut self, from: Address, amount: U256) {
        let token = self.token.get_or_revert_with(MarketError::ZeroAmount);
        Cep18LikeContractRef::new(self.env(), token).transfer_from(
            from,
            self.env().self_address(),
            amount,
        );
    }

    fn push_collateral(&mut self, to: Address, amount: U256) {
        let token = self.token.get_or_revert_with(MarketError::ZeroAmount);
        Cep18LikeContractRef::new(self.env(), token).transfer(to, amount);
    }
}

fn ceil_div(a: U256, b: U256) -> U256 {
    (a + b - U256::one()) / b
}
