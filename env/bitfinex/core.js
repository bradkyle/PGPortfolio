const CONFIG = require('../config.js');
var request = require('request');

const BFX = require('bitfinex-api-node');

const BitfinexClient = function(key, secret) {
    this.bfx = new BFX({
        apiKey: key,
        apiSecret: secret
    });
    this.restOne = this.bfx.rest(1);
    this.restTwo = this.bfx.rest(2);
}


// CREATE BACKOFF MECHANISM
// CREATE ERROR HANDLING MECHANISM


// Return the amount of base currency that can be bought with one 
// quote currency
BitfinexClient.prototype.get_ohlc = function(symbol) {
    return new Promise((resolve, reject) => {      
        request.get(
            ' https://api.bitfinex.com/v2/candles/trade:15m:'+symbol+'/hist?limit='+CONFIG.HISTORIC_SIZE,
            (err, response, body) => {
                     if (err) {
                          return reject(err)
                      }
                     return resolve(JSON.parse(body));
            }
         )      
    });
};

// Return the amount of base currency that can be bought with one 
// quote currency
BitfinexClient.prototype.get_tickers = function() {
    return new Promise((resolve, reject) => {      
        request.get(
            ' https://api.bitfinex.com/v2/tickers?symbols=ALL',
            (err, response, body) => {
                     if (err) {
                          return reject(err)
                      }
                     return resolve(JSON.parse(body));
            }
         )      
    });
};

// Return the amount of base currency that can be bought with one 
// quote currency
BitfinexClient.prototype.get_symbols_tickers = function(symbols) {
    return new Promise((resolve, reject) => {      
        request.get(
            ' https://api.bitfinex.com/v2/tickers?symbols=',
            (err, response, body) => {
                     if (err) {
                          return reject(err)
                      }
                     return resolve(JSON.parse(body));
            }
         )      
    });
};

// Return the amount of base currency that can be bought with one 
// quote currency
BitfinexClient.prototype.get_last_price = function(symbol) {
    return new Promise((resolve, reject) => {
        this.restOne.ticker(symbol, (err, res) => {
            if (err) {
                return reject(err)
            }
            return resolve(parseFloat(res.last_price));
        });
    });
}

// Return the amount of base currency that can be bought with one 
// quote currency
BitfinexClient.prototype.place_multiple_orders = function(orders) {
    return new Promise((resolve, reject) => {
        this.restOne.multiple_new_orders(orders, (err, res) => {
            if (err) {
                console.log(orders);
                return reject(err)
            }
            return resolve(orders)
          })        
    });
}

// Return the amount of base currency that can be bought with one 
// quote currency
BitfinexClient.prototype.get_symbols_details = function() {
    return new Promise((resolve, reject) => {
        this.restOne.symbols_details((err, res) => {
            if (err) {
                return reject(err)
            }
            return resolve(res)
        });
    });
}

BitfinexClient.prototype.cancel_all_orders = function() {
    return new Promise((resolve, reject) => {
        this.restOne.cancel_all_orders((err, res) => {
        if (err) {
            return reject(err)
        }
        return resolve(res);
        });
    });
}

BitfinexClient.prototype.get_balances = async function() {
        return await this.restTwo.balances();
}  

module.exports = {
    BitfinexClient:BitfinexClient
};