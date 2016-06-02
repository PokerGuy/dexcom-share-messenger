if (process.argv.length !== 4) {
    console.log('Please start the server with node app.js [username] [password]');
    process.exit();
}

var username = process.argv[2];
var password = process.argv[3];

var request = require('superagent');
var session;

login(function(response){
   if (response.status === 200) {
       session = response.session;
   } else {
       console.log('There was a problem with the username and password, try again.');
       process.exit();
   }
});

function login(cb) {
    request
        .post('https://share1.dexcom.com/ShareWebServices/Services/General/LoginPublisherAccountByName')
        .send({password: password, applicationId: 'd89443d2-327c-4a6f-89e5-496bbb0317db', accountName: username})
        .set('User-Agent', 'Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .end(function (err, res) {
            cb({status: res.status, session: res.body});
        });
}