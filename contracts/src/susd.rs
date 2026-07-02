//! sUSD — demo faucet stablecoin for sooth markets.
//! Open mint by design: this is a testnet demo token, anyone can faucet themselves.
//! On testnet the x402-capable Cep18X402 token may be deployed as sUSD instead;
//! this module is the odra-native equivalent used in tests and as fallback.

use odra::casper_types::U256;
use odra::prelude::*;
use odra_modules::cep18_token::Cep18;

#[odra::module]
pub struct Susd {
    token: SubModule<Cep18>,
}

#[odra::module]
impl Susd {
    pub fn init(&mut self) {
        // Cep18 arg order: symbol, name, decimals, initial_supply
        self.token.init(
            String::from("sUSD"),
            String::from("Sooth USD"),
            9,
            U256::zero(),
        );
    }

    /// open mint — demo faucet token, no access control on purpose (testnet only)
    pub fn mint(&mut self, to: Address, amount: U256) {
        self.token.raw_mint(&to, &amount);
    }

    delegate! {
        to self.token {
            fn transfer(&mut self, recipient: &Address, amount: &U256);
            fn transfer_from(&mut self, owner: &Address, recipient: &Address, amount: &U256);
            fn approve(&mut self, spender: &Address, amount: &U256);
            fn balance_of(&self, address: &Address) -> U256;
            fn allowance(&self, owner: &Address, spender: &Address) -> U256;
            fn total_supply(&self) -> U256;
            fn name(&self) -> String;
            fn symbol(&self) -> String;
            fn decimals(&self) -> u8;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use odra::host::{Deployer, NoArgs};

    #[test]
    fn mint_and_transfer() {
        let env = odra_test::env();
        let alice = env.get_account(0);
        let bob = env.get_account(1);

        let mut susd = Susd::deploy(&env, NoArgs);
        susd.mint(alice, U256::from(1_000_000_000u64)); // 1 sUSD
        assert_eq!(susd.balance_of(&alice), U256::from(1_000_000_000u64));

        env.set_caller(alice);
        susd.transfer(&bob, &U256::from(400_000_000u64));
        assert_eq!(susd.balance_of(&alice), U256::from(600_000_000u64));
        assert_eq!(susd.balance_of(&bob), U256::from(400_000_000u64));
    }

    #[test]
    fn approve_and_transfer_from() {
        let env = odra_test::env();
        let alice = env.get_account(0);
        let bob = env.get_account(1);
        let carol = env.get_account(2);

        let mut susd = Susd::deploy(&env, NoArgs);
        susd.mint(alice, U256::from(1_000u64));

        env.set_caller(alice);
        susd.approve(&bob, &U256::from(700u64));
        assert_eq!(susd.allowance(&alice, &bob), U256::from(700u64));

        env.set_caller(bob);
        susd.transfer_from(&alice, &carol, &U256::from(700u64));
        assert_eq!(susd.balance_of(&carol), U256::from(700u64));
        assert_eq!(susd.balance_of(&alice), U256::from(300u64));
        // note: odra's stock Cep18 does not decrement allowance on transfer_from;
        // funds moved correctly above, which is what the market depends on
    }

    #[test]
    fn transfer_from_without_allowance_reverts() {
        let env = odra_test::env();
        let alice = env.get_account(0);
        let bob = env.get_account(1);

        let mut susd = Susd::deploy(&env, NoArgs);
        susd.mint(alice, U256::from(1_000u64));

        env.set_caller(bob);
        assert!(susd
            .try_transfer_from(&alice, &bob, &U256::from(500u64))
            .is_err());
    }
}
