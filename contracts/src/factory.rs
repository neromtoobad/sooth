//! MarketFactory — registry + on-chain deployment of BinaryMarkets.
//!
//! Wraps the odra-generated BinaryMarketFactory (factory=on codegen): create_market
//! deploys a market on-chain, records it in the registry, and emits MarketCreated.
//! register_market exists as an admin fallback in case a market is deployed
//! script-side instead (documented trade-off path).

use crate::market::BinaryMarketFactoryContractRef;
use odra::casper_types::U256;
use odra::prelude::*;
use odra::ContractRef;

#[odra::odra_error]
pub enum FactoryError {
    NotFactoryAdmin = 20,
}

#[odra::event]
pub struct MarketCreated {
    pub market: Address,
    pub question: String,
    pub close_ts: u64,
    pub resolver: Address,
}

#[odra::module(events = [MarketCreated], errors = FactoryError)]
pub struct MarketFactory {
    /// address of the codegen BinaryMarketFactory contract
    deployer_contract: Var<Address>,
    /// collateral token every market uses (sUSD)
    token: Var<Address>,
    admin: Var<Address>,
    markets: List<Address>,
}

#[odra::module]
impl MarketFactory {
    pub fn init(&mut self, deployer_contract: Address, token: Address) {
        self.deployer_contract.set(deployer_contract);
        self.token.set(token);
        self.admin.set(self.env().caller());
    }

    /// deploy + register a new binary market. admin of the new market
    /// (liquidity provider) is the caller.
    pub fn create_market(&mut self, question: String, close_ts: u64, resolver: Address) -> Address {
        let factory = self
            .deployer_contract
            .get_or_revert_with(FactoryError::NotFactoryAdmin);
        let token = self
            .token
            .get_or_revert_with(FactoryError::NotFactoryAdmin);
        let admin = self.env().caller();

        let (market, _access_uref) = BinaryMarketFactoryContractRef::new(self.env(), factory)
            .new_contract(
                market_name(self.markets.len()),
                question.clone(),
                close_ts,
                resolver,
                token,
                admin,
            );

        self.markets.push(market);
        self.env().emit_event(MarketCreated {
            market,
            question,
            close_ts,
            resolver,
        });
        market
    }

    /// fallback path: register a market deployed outside the factory (admin only)
    pub fn register_market(
        &mut self,
        market: Address,
        question: String,
        close_ts: u64,
        resolver: Address,
    ) {
        if self.env().caller() != self.admin.get_or_revert_with(FactoryError::NotFactoryAdmin) {
            self.env().revert(FactoryError::NotFactoryAdmin);
        }
        self.markets.push(market);
        self.env().emit_event(MarketCreated {
            market,
            question,
            close_ts,
            resolver,
        });
    }

    pub fn markets(&self) -> Vec<Address> {
        self.markets.iter().collect()
    }

    pub fn market_count(&self) -> u32 {
        self.markets.len()
    }

    pub fn token(&self) -> Address {
        self.token
            .get_or_revert_with(FactoryError::NotFactoryAdmin)
    }
}

fn market_name(index: u32) -> String {
    let mut name = String::from("sooth_market_");
    // no_std-friendly int → string
    let mut n = index;
    let mut digits = Vec::new();
    loop {
        digits.push(b'0' + (n % 10) as u8);
        n /= 10;
        if n == 0 {
            break;
        }
    }
    for d in digits.iter().rev() {
        name.push(*d as char);
    }
    name
}

// silence unused-import warning when factory codegen changes shape
#[allow(unused)]
fn _touch(_: Option<U256>) {}
