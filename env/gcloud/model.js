const util = require('util');
const { google } = require('googleapis');
const CONFIG = require('../config.js');

const normalise = function(pv){
    var sum = pv.reduce((a, b) => a + b, 0);
    return pv.map((ps) => {
        return ps / sum;
    });   
}

module.exports.get_action = async function(inp, prev_w) {      
    return new Promise((resolve, reject) => {
          google.auth.getApplicationDefault( (err, authClient, projectId) => {
              if (err) {
                  console.log('Authentication failed because of ', err);
                  res.status(401).send('Authentication failed');

              } else {

                  var ml = google.ml({
                      version: 'v1',
                      auth: authClient
                  });

                 var instances ={'instances': [{
                     'input': inp,
                     'previous_w':[prev_w],
                 }]};

                  ml.projects.predict({
                      name: util.format('projects/%s/models/%s/versions/%s', CONFIG.PROJECT, CONFIG.MODEL, CONFIG.VERSION),
                      resource: instances
                  }, 
                  function(err, result) {
                      if (err) {
                          return reject(err);
                      }

                      try{

                        let output = result.data["predictions"][0]["output"];
                        resolve(output);    
                      } catch (error){
                          console.log(result.data);
                          return reject(err);
                      }                                          
                 });
             }
          });
  });
}