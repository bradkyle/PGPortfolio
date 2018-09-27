
const nj = require('numjs');
const interval = require('interval-promise');
const CONFIG = require('./config.js');
const log   = require ('ololog').noLocate;
const {
    get_top_assets, 
    get_feature_frame, 
    reset_position,
    execute_position
} = require('./bitfinex/core.js');
const {
    cancel_all_orders
} = require('./bitfinex/transports.js');
const {
    get_action
} = require('./gcloud/model.js');

const step = async function(prev_w) {
    
    // GET CURRENT PORTFOLIO VECTOR    
    
    // GET  TOP VOLUMED ASSETS
    let top_assets = await get_top_assets();
    // console.log(top_assets);

    // GET FEATURE FRAME
    var feature_frame = await get_feature_frame(top_assets);

     // GET PREDICTION FROM GOOGLE CLOUD MACHINE LEARNING ENGINE 
     var action_pv = await get_action(feature_frame, prev_w);

    // CANCEL ALL ORDERS
    await cancel_all_orders();
    // console.log("All orders cancelled");

    // RESET BALANCES TO QUOTE ASSET FOR REDISTRIBUTION
    await reset_position();
    // console.log("Position reset");

    // CONSTRUCT PV FROM ACTION PV (SLICE ACTION PV)
    var pv = nj.array(action_pv).slice(-top_assets.length).tolist();

    // MAKE NEW ORDERS BASED ON PORTFOLIO WEIGHT VECTOR
    await execute_position(pv, top_assets);
    // console.log("Order executed");
    
    // GET AND RETURN INFORMATION SUCH AS PROFIT AND POSITION
    console.log('-'.repeat(100));
}

async function main() {
    console.log("Starting ...");

    await step();

    interval(
        async () => {           
            await step();
        },
        (1000*INTERVAL), 
        {
            stopOnError:false
        }
    );  
};

main()
    .catch((error) => {
        console.error(error);
    });
