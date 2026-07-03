//! TruthStake lifecycle tests: commit → reveal → finalize → claim, with slashing.

use crate::market::{BinaryMarket, BinaryMarketInitArgs};
use crate::stake::{StakeError, TruthStake, TruthStakeInitArgs};
use crate::susd::Susd;
use blake2::digest::{Update, VariableOutput};
use blake2::Blake2bVar;
use odra::casper_types::bytesrepr::Bytes;
use odra::casper_types::U256;
use odra::host::{Deployer, HostRef, NoArgs};
use odra::prelude::*;

const HOUR_MS: u64 = 3_600_000;
const SUSD: u64 = 1_000_000_000;

/// blake2b( [outcome as u8] ++ salt_le ) — must match TruthStake::commitment_preimage
fn commitment(outcome: bool, salt: u64) -> Bytes {
    let mut pre = vec![if outcome { 1u8 } else { 0u8 }];
    pre.extend_from_slice(&salt.to_le_bytes());
    let mut h = Blake2bVar::new(32).unwrap();
    h.update(&pre);
    let mut out = [0u8; 32];
    h.finalize_variable(&mut out).unwrap();
    Bytes::from(out.to_vec())
}

struct World {
    env: odra::host::HostEnv,
    susd: crate::susd::SusdHostRef,
    stake: crate::stake::TruthStakeHostRef,
    market: crate::market::BinaryMarketHostRef,
    a: Address,
    b: Address,
    c: Address,
}

/// Deploy sUSD, the stake contract, and a market whose ONLY resolver is the
/// stake contract — so the market can be settled only through commit-reveal.
fn setup() -> World {
    let env = odra_test::env();
    let admin = env.get_account(0);
    let a = env.get_account(1);
    let b = env.get_account(2);
    let c = env.get_account(3);

    env.set_caller(admin);
    let mut susd = Susd::deploy(&env, NoArgs);
    let now = env.block_time();
    let commit_close = now + HOUR_MS; // market close == commit close
    let reveal_close = now + 2 * HOUR_MS;

    // deploy stake → deploy market with resolver = stake → bind. this makes the
    // stake contract the market's ONLY resolver, so settlement can happen only
    // through commit-reveal. (scripts/deploy uses the same three steps on testnet.)
    let mut stake = TruthStake::deploy(
        &env,
        TruthStakeInitArgs {
            token: susd.address(),
            commit_close,
            reveal_close,
        },
    );
    let market = BinaryMarket::deploy(
        &env,
        BinaryMarketInitArgs {
            question: String::from("Will X happen?"),
            close_ts: commit_close,
            resolver: stake.address(),
            token: susd.address(),
            admin,
        },
    );
    stake.bind_market(market.address());

    for acct in [a, b, c] {
        susd.mint(acct, U256::from(1_000 * SUSD));
        env.set_caller(acct);
        susd.approve(&stake.address(), &U256::from(1_000 * SUSD));
    }
    env.set_caller(admin);

    World { env, susd, stake, market, a, b, c }
}

#[test]
fn full_stake_lifecycle_slashes_the_wrong_side() {
    let mut w = setup();

    // A stakes 100 on YES, B stakes 60 on YES, C stakes 40 on NO
    let (sa, sb, sc) = (100 * SUSD, 60 * SUSD, 40 * SUSD);

    w.env.set_caller(w.a);
    w.stake.commit(commitment(true, 111), U256::from(sa));
    w.env.set_caller(w.b);
    w.stake.commit(commitment(true, 222), U256::from(sb));
    w.env.set_caller(w.c);
    w.stake.commit(commitment(false, 333), U256::from(sc));

    // reveals open after commit_close
    w.env.advance_block_time(HOUR_MS + 1);
    w.env.set_caller(w.a);
    w.stake.reveal(true, 111);
    w.env.set_caller(w.b);
    w.stake.reveal(true, 222);
    w.env.set_caller(w.c);
    w.stake.reveal(false, 333);

    let (yes, no, total) = w.stake.tallies();
    assert_eq!(yes, U256::from(sa + sb));
    assert_eq!(no, U256::from(sc));
    assert_eq!(total, U256::from(sa + sb + sc));

    // finalize after reveal window → YES wins, market resolves YES on-chain
    w.env.advance_block_time(HOUR_MS + 1);
    w.stake.finalize();
    assert!(w.stake.is_finalized());
    assert!(w.stake.outcome());
    assert!(w.market.is_resolved());
    assert!(w.market.outcome());

    // winners split the whole pool proportional to winning stake.
    // pool = 200, winning = 160. A: 200*100/160 = 125. B: 200*60/160 = 75.
    let a_before = w.susd.balance_of(&w.a);
    w.env.set_caller(w.a);
    w.stake.claim();
    assert_eq!(w.susd.balance_of(&w.a) - a_before, U256::from(125 * SUSD));

    let b_before = w.susd.balance_of(&w.b);
    w.env.set_caller(w.b);
    w.stake.claim();
    assert_eq!(w.susd.balance_of(&w.b) - b_before, U256::from(75 * SUSD));

    // loser C is slashed — claim returns nothing and does not revert
    let c_before = w.susd.balance_of(&w.c);
    w.env.set_caller(w.c);
    w.stake.claim();
    assert_eq!(w.susd.balance_of(&w.c), c_before);
}

#[test]
fn bad_reveal_is_rejected() {
    let mut w = setup();
    w.env.set_caller(w.a);
    w.stake.commit(commitment(true, 111), U256::from(50 * SUSD));
    w.env.advance_block_time(HOUR_MS + 1);
    // wrong salt
    assert_eq!(
        w.stake.try_reveal(true, 999).unwrap_err(),
        StakeError::BadReveal.into()
    );
    // wrong outcome
    assert_eq!(
        w.stake.try_reveal(false, 111).unwrap_err(),
        StakeError::BadReveal.into()
    );
    // correct reveal works
    w.stake.reveal(true, 111);
}

#[test]
fn windows_are_enforced() {
    let mut w = setup();
    w.env.set_caller(w.a);
    // cannot reveal before commit window closes
    w.stake.commit(commitment(false, 1), U256::from(10 * SUSD));
    assert_eq!(
        w.stake.try_reveal(false, 1).unwrap_err(),
        StakeError::RevealNotOpen.into()
    );
    // cannot finalize before reveal window closes
    w.env.advance_block_time(HOUR_MS + 1);
    w.stake.reveal(false, 1);
    assert_eq!(w.stake.try_finalize().unwrap_err(), StakeError::TooEarly.into());
    // cannot commit after commit window
    assert_eq!(
        w.stake.try_commit(commitment(true, 2), U256::from(SUSD)).unwrap_err(),
        StakeError::CommitClosed.into(),
    );
}

#[test]
fn double_commit_and_finalize_guards() {
    let mut w = setup();
    w.env.set_caller(w.a);
    w.stake.commit(commitment(true, 7), U256::from(20 * SUSD));
    assert_eq!(
        w.stake.try_commit(commitment(true, 8), U256::from(SUSD)).unwrap_err(),
        StakeError::AlreadyCommitted.into(),
    );
    w.env.advance_block_time(HOUR_MS + 1);
    w.stake.reveal(true, 7);
    w.env.advance_block_time(HOUR_MS + 1);
    w.stake.finalize();
    assert_eq!(w.stake.try_finalize().unwrap_err(), StakeError::AlreadyFinalized.into());
}
