const chai = require("chai");
const expect = chai.expect;
var sinon = require('sinon');
const asserttype = require('chai-asserttype');
chai.use(asserttype);
const {
    derive_currency,
    derive_symbol,
    derive_balances_norm,
    derive_balance_value,
    get_top_assets,
    derive_pv,
    get_col,
    get_feature_frame,
    execute_position,
    get_total_balance,
    reset_position,
    clean_execution_orders
} = require('./wrapper.js');
const BitfinexClient = require('./core.js').BitfinexClient;
const nj = require("numjs");
const CONFIG = require('../config.js');
var fs = require('fs');

const assets = [
    'BCHBTC',
    'XRPBTC',
    'ETHBTC',
    'EOSBTC',
    'LTCBTC',
    'XMRBTC',
    'IOTBTC',
    'NEOBTC',
    'BTGBTC',
    'ETCBTC',
    'ZECBTC',
    'DSHBTC',
    'XTZBTC',
    'ETPBTC',
    'TRXBTC' 
];

const client = new BitfinexClient(CONFIG.BITFINEX_KEY, CONFIG.BITFINEX_SECRET);

const symbols_details_resp = JSON.parse(fs.readFileSync('./data/symbols_details.json', 'utf8'));
const balance_resp = JSON.parse(fs.readFileSync('./data/balances.json', 'utf8'));
const tickers_resp = JSON.parse(fs.readFileSync('./data/tickers.json', 'utf8'));
const ohlc_resp = JSON.parse(fs.readFileSync('./data/ohlc.json', 'utf8'));
const example_orders = JSON.parse(fs.readFileSync('./data/orders.json', 'utf8'));

describe('bitfiex wrapper funcitonality', () => {
    var get_last_price = sinon.stub(BitfinexClient.prototype, 'get_last_price');
    get_last_price.returns(1);
    get_last_price.withArgs("BCHBTC").returns(1);

    var get_tickers = sinon.stub(BitfinexClient.prototype, 'get_tickers');
    get_tickers.returns(tickers_resp);

    var get_balances = sinon.stub(BitfinexClient.prototype, 'get_balances');
    get_balances.returns(balance_resp);    

    var symbols_details = sinon.stub(BitfinexClient.prototype, 'get_symbols_details');
    symbols_details.returns(symbols_details_resp);

    describe("get col", () => {
        it("returns a column from a 2D array", async () => {
            let arr =  nj.arange(15).reshape(3, 5).tolist();
            let col = await get_col(arr, 0);
            expect(col).to.eql([ 0,5,10]);
        });
    });

    describe("get feature frame", () => {
        it("returns the set of feature columns for each asset", async () => {
            
            let ohlc = nj.arange(6).tolist();
            
            let candles_resp = [];
            for (var x=0;x<95;x++) {
                    candles_resp[x] = ohlc
            };

            var get_ohlc = sinon.stub(BitfinexClient.prototype, 'get_ohlc');
            get_ohlc.returns(candles_resp);
            
            let feature_frame = await get_feature_frame(client, assets, 90);

            let nj_ff = nj.array(feature_frame);

            expect(nj_ff.shape).to.eql([ 3,15,90 ]);

            expect(feature_frame[0][0][0]).to.eql(2);
            expect(feature_frame[1][0][0]).to.eql(3);
            expect(feature_frame[2][0][0]).to.eql(4);
        });
    });

    describe("get total balance", () => {
        it("calculates total balance from an array of balance objects",async  () => {
            
            let total_balance = get_total_balance(balance_resp, 'BTC');
            expect(total_balance).to.be.number();

            
        });
    });

    describe("clean execution orders", () => {
        it("removes any invalid orders from an order execution array before being sent",async  () => {
            
            
            let orders = await clean_execution_orders(client, example_orders);
            

            
        });
    });

    describe("create orders from pv", () => {
        it("removes any invalid orders from an order execution array before being sent",async  () => {
            expect(true).to.be.true;
        });
    });

    describe("execute position", () => {
        it("recieves a portfolio vector action from a model and", async () => {
            
            var place_multiple_orders = sinon.stub(BitfinexClient.prototype, 'place_multiple_orders');
            place_multiple_orders.returns("hello");

            let pv = nj.random([15]).tolist();

            await execute_position(client, pv, assets, 'BTC')

            place_multiple_orders.restore();
        });
    });

    describe("clean reset orders", () => {
        it("removes any invalid orders from an order execution array before being sent",async  () => {
            expect(true).to.be.true;
        });
    });

    describe("reset position", () => {
        it("generates a portfolio vector representing the distribution of available balances", async () => {
            // var place_multiple_orders = sinon.stub(BitfinexClient.prototype, 'place_multiple_orders');
            // place_multiple_orders.returns(symbols_details_resp);


            // place_multiple_orders.restore();
        });
    });

    describe.skip("get top assets", () => {
        it("generates a portfolio vector representing the distribution of available balances", async () => {
            let top_assets = await get_top_assets(client, CONFIG.QUOTE_ASSET, 15);
            expect(top_assets).to.eql(assets);
        });
    });

    describe("derive pv", () => {
        it("generates a portfolio vector representing the distribution of available balances", async () => {
            let balances_norm = [0,0,0,0,0,1,0,0,0,0,0,1,0,0,0];
            let pv = await derive_pv(balances_norm);
            expect(pv).to.eql([ 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0.5, 0, 0, 0 ]);
        });
    });

    describe("derive balances norm", () => {
        it("generates a vector of balances normalised to the quote asset ", async () => {

            let balances_norm =
                await derive_balances_norm(client, assets, balance_resp, 'BTC');

            expect(balances_norm).to.eql([1,1,1,1,1,0,0,0,1,1,0,0,0,0,0]);

        });
    });

    describe("derive balance  value", () => {
        it("generates a vector of balances normalised to the quote asset ", async () => {
            let balance_value =
                await derive_balance_value(client, balance_resp[0], 'BTC');

            expect(balance_value).to.equal(1);
        });
    });

    describe("derive symbol", () => {
        it("gets currency from a symbol", async () => {
            let currency = "xrp"
            let symbol = derive_symbol(currency, 'BTC');
            expect(symbol).to.equal('XRPBTC');
        });
    });

    describe("derive currency", () => {
        it("gets currency from a symbol", async () => {
            let symbol = "XRPBTC"
            let currency = derive_currency(symbol, 'BTC');
            expect(currency).to.equal('xrp');
        });
    });

});