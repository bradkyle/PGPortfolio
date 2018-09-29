
const nj = require('numjs');
const interval = require('interval-promise');
const CONFIG = require('./config.js');
const log   = require ('ololog').noLocate;
const {
    get_top_assets, 
    get_feature_frame, 
    reset_position,
    execute_position,
    get_portfolio_value,
    get_pv
} = require('./bitfinex/wrapper.js');
const {
    get_action
} = require('./gcloud/model.js');
var Table = require('cli-table');
var ProgressBar = require('progress');
const BitfinexClient = require('./bitfinex/core.js').BitfinexClient;


var bar = new ProgressBar(':bar', { 
    total: parseInt(CONFIG.INTERVAL)/3,
    complete:'#',
    incomplete: '',
}); 
let prev_portfolio_value = 0
const client = new BitfinexClient(CONFIG.BITFINEX_KEY, CONFIG.BITFINEX_SECRET);

const create_pv_table = async function(assets, pv){
     pv_table_rows = [];
     for (var i=0; i<assets.length;i++){
         pv_table_rows.push([assets[i] ,pv[i]])
     }
     return pv_table_rows;
}

const step = async function() {
    // SHOw PROGRESS BAR

    // GET  TOP VOLUMED ASSETS IN LAST 24 HOURS
    let top_assets = await get_top_assets(client, CONFIG.QUOTE_ASSET, CONFIG.ASSET_NUM);

    // GET CURRENT PORTFOLIO VECTOR   
    let prev_pv = await get_pv(client, top_assets, CONFIG.QUOTE_ASSET);

    // GET FEATURE FRAME
    var feature_frame = await get_feature_frame(client, top_assets, CONFIG.HISTORIC_SIZE);

     // GET PREDICTION FROM GOOGLE CLOUD MACHINE LEARNING ENGINE 
     var action_pv = await get_action(feature_frame, prev_pv, CONFIG.PROJECT, CONFIG.MODEL, CONFIG.VERSION);
    console.log(action_pv);

    // CANCEL ALL ORDERS
    await client.cancel_all_orders();
    // console.log("All orders cancelled");

    // RESET BALANCES TO QUOTE ASSET FOR REDISTRIBUTION
    await reset_position(client, CONFIG.QUOTE_ASSET);

    // GET CURRENT PORTFOLIO VALUE IN DOLLARS
    var portfolio_value = await get_portfolio_value(client, top_assets, CONFIG.CASH_ASSET, CONFIG.QUOTE_ASSET);

    // CONSTRUCT PV FROM ACTION PV (SLICE ACTION PV)
    var pv = nj.array(action_pv).slice(-CONFIG.ASSET_NUM).tolist();

    // MAKE NEW ORDERS BASED ON PORTFOLIO WEIGHT VECTOR
    await execute_position(client, pv, top_assets, CONFIG.QUOTE_ASSET);

    // GET AND RETURN INFORMATION SUCH AS PROFIT AND POSITION
    var stats_table = new Table();
    var pv_table = new Table({
        head: ['Asset pair symbol', 'PV Scalar'],
        colWidths: [50, 50]
    });
     
   stats_table.push(
       { 'Step Profit':  portfolio_value - prev_portfolio_value},
       { 'Portfolio Value': portfolio_value}
    );

    pv_table.push(await create_pv_table(pv, top_assets));
    
    console.log(stats_table.toString());
    console.log(pv_table.toString());
    console.log('='.repeat(100));

    prev_portfolio_value = portfolio_value;
}

async function main() {
    console.log("Starting ...");
   
    let prev_w = nj.random([CONFIG.ASSET_NUM]).tolist();

    await step();

    interval(
        async () => {        
            await step();
        },
        (1000*CONFIG.INTERVAL), 
        {
            stopOnError:false
        }
    );  
};

main()
    .catch((error) => {
        console.error(error);
    });

