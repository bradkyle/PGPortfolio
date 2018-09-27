const CONFIG = require('../config.js');
const {restTwo, restOne} = require('./init.js'); 
var request = require('request');

// Return the amount of base currency that can be bought with one 
// quote currency
module.exports.get_ohlc = function(symbol) {
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
module.exports.get_tickers = function() {
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
module.exports.get_symbols_tickers = function(symbols) {
    // TODO convert symbols to tBTCSJSKJ

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
module.exports.get_last_price = function(symbol) {
    return new Promise((resolve, reject) => {
        restOne.ticker(symbol, (err, res) => {
            if (err) {
                return reject(err)
            }
            return resolve(parseFloat(res.last_price));
        });
    });
}

// Return the amount of base currency that can be bought with one 
// quote currency
module.exports.place_multiple_orders = function(orders) {
    return new Promise((resolve, reject) => {
        restOne.multiple_new_orders(orders, (err, res) => {
            if (err) {
                return reject(err)
            }
            return resolve(orders)
          })        
    });
}

// Return the amount of base currency that can be bought with one 
// quote currency
module.exports.get_symbols_details = function(symbol) {
    return new Promise((resolve, reject) => {
        restOne.symbols_details((err, res) => {
            if (err) {
                return reject(err)
            }
            return resolve(res)
        });
    });
}

module.exports.cancel_all_orders = function() {
    return new Promise((resolve, reject) => {
        restOne.cancel_all_orders((err, res) => {
        if (err) {
            return reject(err)
        }
        return resolve(res);
        });
    });
}  