const CONFIG = require('../config.js');
const {restTwo, restOne} = require('./init.js'); 
const {
    get_tickers,
    get_symbols_details,
    get_ohlc,
    place_multiple_orders,
    get_last_price
} = require('./transports.js');

const get_col = async function(arr,index) {
    let col = [];
    for (var r=0; r<arr.length; r++) {
           col[r] = arr[r][index];
    }
    return col;
}

// sends ASSET_NUM (15) requests to bitfinex per invocation
module.exports.get_feature_frame = async function(assets) {    
    var close = [];
    var high = [];
    var low = [];
    var frame = [];
    
    for (var i=0;i<assets.length;i++) {
        let ohlc = await get_ohlc( 't'+assets[i]);
        close[i] = await get_col(ohlc, 2);
        high[i] = await get_col(ohlc, 3);
        low[i] =  await get_col(ohlc, 4);          
    };
    
    frame = [close,high,low]; 
    return frame
}

const clean_execution_orders = async function(orders) {     
    let symbols_details = await get_symbols_details();    
    orders = orders.filter(function (order){         
            var symbol_details = symbols_details.filter(function (detail) {
                 return detail.pair === order.symbol.toLowerCase();
           })[0];
           return parseFloat(order.amount)  >=  parseFloat(symbol_details.minimum_order_size);
   });    
   return orders
}

// Sends 3 + ASSET_NUM (15) requests to bitfinex per invocation
module.exports.execute_position = async function(pv, assets) {
   
    // Get Available balances in exchange account
    const balances = await restTwo.balances();  

    // Determines total balance left in QUOTE_ASSET
    var total_balance = balances
            .filter(({type}) => type === 'exchange')
            .filter(({currency}) => currency === CONFIG.QUOTE_ASSET.toLowerCase())
            .reduce(function(sum, balance){return sum + balance.available},0);

    // construct orders with respect to the portfolio vector    
    var orders =  await Promise.all(
        await pv.map(async (ps, index) => {
            let symbol = assets[index];
            let last_price = await get_last_price(symbol);

            // Let the amount ordered equal the fraction of the
            // total QUOTE_ASSET balance * the amount of base
            // asset that can be bought with 1 QUOTE_ASSET
            let amount = (ps * total_balance) * (1/last_price);
             return {
                  symbol: symbol,
                  amount: amount,
                  exchange: 'bitfinex',
                  price: '1000',
                  side: 'buy',
                  type: 'exchange market'
            }
    }));    

    // Remove invalid orders
    orders = await clean_execution_orders(orders);
        
    // Batch orders and send to bitfinex
    await place_multiple_orders(orders);
}

const clean_orders = async function(orders) {
    return orders.filter(function( order ) {
        if (order === undefined) return false
        if (parseFloat(order.amount) === 0.0) return false
        return true
    });
}

// Sends 2 requests to bitfinex per invocation
module.exports.reset_position = async function() {

    var balances = await restTwo.balances();

    // NORMALIZE BALANCES
    var orders = await Promise.all(
        await balances.map(async (balance) => {
            if (balance.type = "exchange"){
                    if (balance.currency !=CONFIG.QUOTE_ASSET.toLowerCase()){                    
                        return {
                              symbol: (balance.currency+CONFIG.QUOTE_ASSET).toUpperCase(),
                              amount: balance.available,
                              exchange: 'bitfinex',
                              price: '1000',
                              side: 'sell',
                              type: 'exchange market'
                        }
                    }
            }        
    }));
    
    // Remove invalid orders
    orders = await clean_orders(orders);
        
    // Batch orders and send to bitfinex
    await place_multiple_orders(orders);
}

// sends 1 Request to bitfinex per invocation
// Return the amount of base currency that can be bought with one 
// quote currency
module.exports.get_top_assets = async function(quote_asset, asset_num) {
    let tickers = await get_tickers();
    
    // get all tickers with the respective quote asset
    tickers = tickers.filter(function(ticker){
        return ticker[0].endsWith(CONFIG.QUOTE_ASSET);
    });
    
    // Sort tickers by most volume descending
    tickers = tickers.sort(function(a,b){     
        let a_value = a[8]*a[7];
        let b_value = b[8]*b[7];
        return b_value - a_value;
    });
    
    // Get the top ASSET_NUM tickers
    tickers = tickers.slice(0, (CONFIG.ASSET_NUM));
    
    // remove 't' from bitfinex api v2 symbol string
    let top_assets = tickers.map(function (ticker) {
        return ticker[0].substr(1);
    });
    
    return top_assets;
}

// Sends 2 requests to bitfinex per invocation
module.exports.get_pv = async function() {

    var balances = await restTwo.balances();
    let tickers = await get_tickers();

    // For each balance which has a currency
    // other than the QUOTE_ASSET derive the
    // coverted balance with respect to the 
    // QUOTE_ASSET
    var total_balance = balances
            .filter(({type}) => type === 'exchange')
            .map(function(sum, balance){return sum + balance.available},0);
    
    // NORMALIZE BALANCES
    var orders = await Promise.all(
        await balances.map(async (balance) => {
            if (balance.type = WALLET){
                    if (balance.currency !=CONFIG.QUOTE_ASSET.toLowerCase()){                    
                        return {
                              symbol: (balance.currency+CONFIG.QUOTE_ASSET).toUpperCase(),
                              amount: balance.available,
                              exchange: 'bitfinex',
                              price: '1000',
                              side: 'sell',
                              type: 'exchange market'
                        }
                    }
            }        
    }));
}
