/**
 * Monetization — 手游商业化核心模块
 *
 * 覆盖：
 *  - Store：商品目录、价格阶梯、购买校验
 *  - IAPValidator：票据校验、签名验证、发货、恢复购买
 *  - CurrencyManager：双货币模型（金币/钻石）、交易记录、兑换
 */

export * from './store';
export * from './battle-pass';
export * from './bundles';
export * from './ads';
