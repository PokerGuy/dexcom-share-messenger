var request = require('superagent');
var moment = require('moment-timezone');
var session;

if (process.argv.length !== 4) {
    console.log('Please start the server with node app.js [username] [password]');
    process.exit();
}

var username = process.argv[2];
var password = process.argv[3];


//Node is weird in that it is asynchronous
//The first thing we do is attempt to login and provide an anonymous function as a callback
//If we successfully login, we then start the process of polling every five minutes,
//If not, we provide an error message
//However, we have to call the function start() from within the callback, otherwise we would attempt to monitor without a session

login(function(response){
   if (response.status === 200) {
       session = response.session;
       console.log('Obtained a login, service starting');
       start();
   } else {
       console.log('There was a problem with the username and password, try again.');
       //Running the process using forever is negating the process.exit, need to make sure the user knows to check and make sure the process started
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
        if (result.status !== 200) {
            setTimeout(relogin, 240000);
            //Notify the user somehow? Unable to get a login...
        } else {
            session = result.session;
            start();
        }
    }), 240000);
}

function start() {
    getGlucose(function(result) {
        console.log(result.value);
        var now = new Date();
        var timeElapsed = now - result.time;
        var next = 300000 - timeElapsed;
        next += 60000; //Give it about a minute for the data to get into the Share service...
        if (next < 0) {
            console.log('New value not available, waiting another 30 seconds');
            setTimeout(start, 30000);
        } else {
            console.log('Last reading at ' + moment.tz(result.time, "America/Los_Angeles").format());
            console.log(next + ' milliseconds until next call.');
            setTimeout(start, next);
        }
    });
}

function getGlucose(cb) {
    var url = 'https://share1.dexcom.com/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues?sessionId=' + session + '&minutes=1440&maxCount=1';
    request
        .post(url)
        .set('User-Agent', 'Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0')
        .set('Content-Type', 'application/json')
        .set('Content-Length', 0)
        .set('Accept', 'application/json')
        .end(function(err, res) {
            if (err) {
                relogin();
            } else {
                var j = JSON.parse(res.text);
                var json = j[0];
                var regex = /\((.*)\)/;
                var wall = parseInt(json.WT.match(regex)[1]);
                cb({value: json.Value, trend: json.Trend, time: wall});
            }
        })
}