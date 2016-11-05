var request = require('superagent');
var update = require('./controllers/update');
var dexData = require('./dexData');
var moment = require('moment-timezone');
var Reading = require('./models/reading');
var session;

exports.login = function() {
    doLogin()
};

function doLogin() {
    request
        .post('https://share1.dexcom.com/ShareWebServices/Services/General/LoginPublisherAccountByName')
        .send({
            password: process.env.DEXCOM_PASSWORD,
            applicationId: 'd89443d2-327c-4a6f-89e5-496bbb0317db',
            accountName: process.env.DEXCOM_USERNAME
        })
        .set('User-Agent', 'Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .end(function (err, res) {
            if (err) {
                console.log('Error');
                console.log(err);
                console.log('Response ');
                console.log(res);
            } else {
                session = res.body;
                console.log('Success reaching dexcom');
                polling();
            }
        });
};

function polling() {
    console.log('Now in the polling function...');
    getGlucose(function (result) {
        if (result.error != undefined) {
            relogin();
        } else {
            dexData.setGlucose(result.value);
            dexData.setLastEntry(new Date(result.time));
            dexData.setTrend(result.trend);
            var now = new Date();
            var timeElapsed = now - result.time;
            dexData.setNext(300000 - timeElapsed + 60000);
            if (dexData.next < 0) {
                console.log('New value not available, waiting another 30 seconds');
                setTimeout(polling, 30000);
                nextCall = new Date(now + 30000);
                update.doUpdate('no data');
            } else {
                dexData.setLastEntry(moment.tz(result.time, "America/Chicago").format());
                update.setLastEntry(dexData.lastEntry);
                console.log('Last reading at ' + dexData.lastEntry);
                console.log(dexData.next + ' milliseconds until next call.');
                setTimeout(polling, dexData.next);
                nextCall = new Date(now + dexData.next);
                Reading.addReading(result.time, dexData.glucose);
                update.doUpdate('regular update', dexData.glucose, dexData.trend, dexData.next);
            }
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
        .end(function (err, res) {
            if (err) {
                cb({error: "relogin"});
            } else {
                var j = JSON.parse(res.text);
                var json = j[0];
                var regex = /\((.*)\)/;
                var wall = parseInt(json.WT.match(regex)[1]);
                cb({value: json.Value, trend: json.Trend, time: wall});
            }
        })
}

function relogin() {
    setTimeout(doLogin(function (result) { //this is causing the crash
        if (result.status !== 200) {
            setTimeout(relogin, 240000);
            //Notify the user somehow? Unable to get a login...
        } else {
            session = result.session;
            polling();
        }
    }), 240000);
}