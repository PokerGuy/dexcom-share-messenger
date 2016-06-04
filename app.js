if (process.argv.length !== 4) {
    console.log('Please start the server with node app.js [username] [password]');
    process.exit();
}

var username = process.argv[2];
var password = process.argv[3];

var request = require('superagent');
var session;
var i = 0;

//Node is weird in that it is asynchronous
//The first thing we do is attempt to login and provide an anonymous function as a callback
//If we successfully login, we then start the process of polling every five minutes,
//If not, we provide an error message
//However, we have to call the function start() from within the callback, otherwise we would attempt to monitor without a session

login(function(response){
   if (response.status === 200) {
       session = response.session;
       start();
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

function relogin() {
    setTimeout(login(function(result){
        console.log('Attempt number ' + (i + 1) + ' to get a new session from Share');
        i++;
        if (i >= 3) {
            console.log('Unable to reach Share or get a new Session');
            process.exit();
        }
        if (result.status !== 200) {
            setTimeout(relogin, 240000);
        } else {
            i = 0; //we successfully got a new session, restart the counter
            session = result.session;
        }
    }), 240000);
}

function start() {
    getGlucose();
    var poll = setInterval(getGlucose, 300000);
}

function getGlucose() {
    var url = 'https://share1.dexcom.com/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues?sessionId=' + session + '&minutes=1440&maxCount=1';
    request
        .post(url)
        .set('User-Agent', 'Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0')
        .set('Content-Type', 'application/json')
        .set('Content-Length', 0)
        .set('Accept', 'application/json')
        .end(function(err, res) {
            if (err) {
                //Uh-oh let's keep try 3 times to get a new session
                console.log('Error reaching Share, trying to get a new session. Will try 3x...');
                console.log(err);
                relogin();
            } else {
                console.log('res');
                console.log(res.statusCode);
                console.log(JSON.parse(res.text));
            }
        })
}