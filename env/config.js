const process = require('process');

if (process.env.NODE_ENV !== 'production'){
    require('dotenv').load();
}

const CONFIG = {
    INTERVAL: process.env.INTERVAL,
    QUOTE_ASSET: process.env.QUOTE_ASSET,
    ASSET_NUM: process.env.ASSET_NUM,
    HISTORIC_SIZE: process.env.HISTORIC_SIZE,
    FEATURE_NUM: process.env.FEATURE_NUM,
    PROJECT : process.env.PROJECT,
    MODEL : process.env.MODEL,
    VERSION : process.env.VERSION,
    EXCHANGE: process.env.EXCHANGE,
    ORDER_TYPE: process.env.ORDER_TYPE,
    BITFINEX_KEY:process.env.BITFINEX_KEY,
    BITFINEX_SECRET: process.env.BITFINEX_SECRET
};

console.log('-'.repeat(100));
console.log(CONFIG);
console.log('-'.repeat(100));

module.exports = CONFIG;
