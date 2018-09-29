const util = require('util');
const { google } = require('googleapis');

const normalise = function(pv){
    var sum = pv.reduce((a, b) => a + b, 0);
    return pv.map((ps) => {
        return ps / sum;
    });   
}

module.exports.get_action = async function(inp, prev_w, project, model, version) {      
    return new Promise((resolve, reject) => {
          google.auth.getApplicationDefault( (err, authClient, projectId) => {
              if (err) {
                  console.log('Authentication failed because of ', err);
                  res.status(401).send('Authentication failed');

              } else {

                 console.log("Getting Action Prediction From Trained Model ...");
                  var ml = google.ml({
                      version: 'v1',
                      auth: authClient
                  });

                 var instances ={'instances': [{
                     'input': inp,
                     'previous_w':[prev_w],
                 }]};

                  ml.projects.predict({
                      name: util.format('projects/%s/models/%s/versions/%s', project, model, version),
                      resource: instances
                  }, 
                  function(err, result) {
                      if (err) {
                          return reject(err);
                      }

                      try{
                        let output = result.data["predictions"][0]["output"];                                        
                        return resolve(output);  
                        
                      } catch (error){
                          console.error("Model Output Was Invalid");
                          console.log(result);
                          return reject(err);
                      }                                          
                 });
             }
          });
  });
}