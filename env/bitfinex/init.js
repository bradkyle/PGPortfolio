const BFX = require('bitfinex-api-node');
const CONFIG = require('../config.js');

const bfx = new BFX({
    apiKey: CONFIG.BITFINEX_KEY,
    apiSecret: CONFIG.BITFINEX_SECRET
})

const restOne = bfx.rest(1);
const restTwo = bfx.rest(2);

module.exports = {
    restOne:restOne,
    restTwo:restTwo
};