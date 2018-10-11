const CONFIG = require('../config.js');
const nj = require("numjs");



// Top Volumed Assets
// ----------------------------------------------------------------------------------------------------------------->

// sends 1 Request to bitfinex per invocation
// Return the amount of base currency that can be bought with one 
// quote currency
const get_top_assets = async function(client, quote_asset, asset_num) {
    console.log('Retrieving top assets ...');

    let tickers = await client.get_tickers();
    
    // get all tickers with the respective quote asset
    tickers = tickers.filter(function(ticker){
        return ticker[0].endsWith(quote_asset);
    });
    
    // Sort tickers by most volume descending
    tickers = tickers.sort(function(a,b){     
        let a_value = a[8]*a[7];
        let b_value = b[8]*b[7];
        return b_value - a_value;
    });
    
    // Get the top ASSET_NUM tickers
    tickers = tickers.slice(0, (asset_num));
    
    // remove 't' from bitfinex api v2 symbol string
    let top_assets = tickers.map(function (ticker) {
        return ticker[0].substr(1);
    });
    
    return top_assets;
}

// Get a Feature frame Derived From Candle Charts
// ----------------------------------------------------------------------------------------------------------------->


const get_col = async function(arr,index) {
    let col = [];
    for (var r=0; r<arr.length; r++) {
           col[r] = arr[r][index];
    }
    return col;
}

// sends ASSET_NUM (15) requests to bitfinex per invocation
const get_feature_frame = async function(client, assets, historic_size) {  
    console.log('Retrieving Feature Frame ...');  
    var close = [];
    var high = [];
    var low = [];
    var frame = [];
    
    for (var i=0;i<assets.length;i++) {
        let ohlc = await client.get_ohlc( 't'+assets[i]);
        ohlc = nj.array(ohlc).slice([historic_size]).tolist();
        close[i] = await get_col(ohlc, 2);
        high[i] = await get_col(ohlc, 3);
        low[i] =  await get_col(ohlc, 4);          
    };
    
    frame = [close,high,low]; 
    return frame
}




// Position Execution
// ----------------------------------------------------------------------------------------------------------------->

const execute_position = async function(client, pv, assets, quote_asset) {   
    console.log('Executing Portfolio Action Vector ...');
    // Get Available balances in exchange account
    const balances = await client.get_balances();  

   const total_balance = get_total_balance(balances, quote_asset);

   console.log("total balance: "+total_balance.toString())

    // construct orders with respect to the portfolio vector    
    var orders = await create_orders_from_pv(client, pv, total_balance, assets);

    // Remove invalid orders
    orders = await clean_execution_orders(client, orders)

    // Batch orders and send to bitfinex
    await client.place_multiple_orders(orders);
}

const get_total_balance = function(balances, quote_asset) {
     // Determines total balance left in QUOTE_ASSET
    balances = balances
     .filter(({type}) => type === 'exchange')
     .filter(({currency}) => currency === quote_asset.toLowerCase())

    let total_balance = 0;
    for (balance of balances){
        total_balance += parseFloat(balance.available);
    }
    return total_balance;
}

const clean_execution_orders = async function(client, orders) {     
    let symbols_details = await client.get_symbols_details();    
    orders = orders.filter(function (order){        
            var symbol_details = symbols_details.filter(function (detail) {
                 return detail.pair === order.symbol.toLowerCase();
           })[0];

           return parseFloat(order.amount)  >=  parseFloat(symbol_details.minimum_order_size);
   });    
   return orders
}

const create_orders_from_pv = async function(client, pv, total_balance, assets) {
    return await Promise.all(
        await pv.map(async (ps, index) => {
            let symbol = assets[index];
            let last_price = await client.get_last_price(symbol);
            

            // Let the amount ordered equal the fraction of the
            // total QUOTE_ASSET balance * the amount of base
            // asset that can be bought with 1 QUOTE_ASSET
            let portion = (ps * total_balance);
            if (portion >= total_balance) {
                console.log("Amount too high");
                portion=total_balance - (total_balance * 0.80);
            } 
            //TODO fix pricing issue
            // Should exit at market price plus 0.2 referenced
            // 
            let amount =  (portion * (1/last_price));

            return {
                  symbol: symbol,
                  amount: amount,
                  exchange: 'bitfinex',
                  price: '1000',
                  side: 'buy',
                  type: 'exchange market'
            }
    }));    
}



// Reset Position
// ----------------------------------------------------------------------------------------------------------------->

// Sends 2 requests to bitfinex per invocation
const reset_position = async function(client, quote_asset) {
    console.log('Resetting Position...');
    var balances = await client.get_balances();
    var orders = await create_orders_from_balances(balances, quote_asset);    
    orders = await clean_reset_orders(orders);        
    await client.place_multiple_orders(orders);
}

const clean_reset_orders = async function(orders) {
    return orders.filter(function( order ) {
        if (order === undefined) return false
        if (parseFloat(order.amount) === 0.0) return false
        return true
    });
};

const create_orders_from_balances = async function(balances, quote_asset) {
    return await Promise.all(
        await balances.map(async (balance) => {
            if (balance.type = "exchange"){
                    if (balance.currency !=quote_asset.toLowerCase()){                    
                        return {
                              symbol: (balance.currency+quote_asset).toUpperCase(),
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



// Portfolio value and vector
// ----------------------------------------------------------------------------------------------------------------->

// sends 1 Request to bitfinex per invocation
// Return the amount of base currency that can be bought with one 
// quote currency
// TODO make robust  with  respect to other portfolio values
const get_portfolio_value = async function(client, assets, cash_asset, quote_asset) {
    console.log('Getting Current Value of Portfolio...');
    let symbol = quote_asset+cash_asset;
    console.log(symbol);
    var balances = await client.get_balances();   
    var balances_norm = await derive_balances_norm(client, assets, balances);
    let total_balances_norm =  balances_norm.reduce((sum, balance) => sum + balance);
    let price = await client.get_last_price(symbol);
    return parseFloat(total_balances_norm) * parseFloat(price);
}

// Sends 1 + 15 requests to bitfinex per invocation
const get_pv = async function(client, assets, quote_asset) {
    console.log('Deriving Portfolio Vector...');
    var balances = await client.get_balances();  
    var balances_norm = await derive_balances_norm(client, assets, balances, quote_asset);
    var pv = await derive_pv(assets, balances_norm);
    return pv;
}

// Returns an array of scalar values corresponding to the magnitude of the balance
// available in the respective asset wallet resolved into QUOTE_ASSET amount
const derive_pv = async function(balances_norm){
    let total_balances_norm =  balances_norm.reduce((sum, balance) => sum + balance);
    var pv = [];
    for (var i =0; i<balances_norm.length; i++){
        if (balances_norm[i] > 0 && total_balances_norm > 0){
            pv[i] = balances_norm[i] / total_balances_norm; 
        } else {
            pv[i] = 0
        }
    }
    return pv;
}

const derive_balances_norm = async function(client, assets, balances, quote_asset) {
    balances_norm = [];
    for (var i=0;i<assets.length;i++){
          let balance =  balances
           .filter(({type}) => type === 'exchange')
           .filter(({currency}) => currency === derive_currency(assets[i], quote_asset));
           let value = await derive_balance_value(client, balance[0], quote_asset);
           if(value !== undefined) {  
                 balances_norm[i] = value;
           } else {
                 balances_norm[i] = 0;
           }
    }
    return balances_norm;
}

const derive_balance_value = async function(client, balance, quote_asset) {     
       if(balance !== undefined) {  
           if (balance.amount > 0.0){
                let symbol = await derive_symbol(balance.currency, quote_asset);
                let last_price = await client.get_last_price(symbol);
                return balance.available * last_price;
           }
       }
}

const derive_currency = function(symbol, quote_asset){
    return symbol.substring(0,symbol.indexOf(quote_asset)).toLowerCase();
}

const derive_symbol = function(currency, quote_asset){
    return (currency + quote_asset).toUpperCase()
}

module.exports = {
    get_col:get_col,
    get_feature_frame:get_feature_frame,
    clean_execution_orders:clean_execution_orders,
    execute_position:execute_position,
    clean_reset_orders:clean_reset_orders,
    reset_position:reset_position,
    get_top_assets:get_top_assets,
    get_pv:get_pv,
    derive_pv:derive_pv,
    derive_balances_norm:derive_balances_norm,
    derive_symbol:derive_symbol,
    derive_currency:derive_currency,
    derive_balance_value:derive_balance_value,
    get_portfolio_value:get_portfolio_value,
    get_total_balance:get_total_balance
}