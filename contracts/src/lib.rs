#![cfg_attr(not(test), no_std)]
#![cfg_attr(not(test), no_main)]
extern crate alloc;

pub mod factory;
pub mod market;
pub mod susd;

pub use factory::MarketFactory;
pub use market::*;
pub use susd::Susd;

#[cfg(test)]
mod tests;
