var request = require('superagent');
var sys = require('util');
var bodyParser = require('body-parser');
var session;
var nextCall;
var dexData = require('./dexData');
var Reading = require('./models/reading');
var moment = require('moment-timezone');
const env = require('env2')('./env.json');
var check = require('./paramchecker');
var mongoose = require('mongoose');
var express = require('express');
var routes = require('./routes');
var app = express();
var update = require('./controllers/update');
var server;

check.check(function (pass) {
    if (!pass) {
        console.log('Please fix the env.json file and restart...');
        process.exit();
    } else {
        //Node is weird in that it is asynchronous
        //The first thing we do is attempt to login and provide an anonymous function as a callback
        //If we successfully login, we then start the process of polling every five minutes,
        //If not, we provide an error message
        //However, we have to call the function start() from within the callback, otherwise we would attempt to monitor without a session
        login(function (response) {
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

    }
});

function login(cb) {
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
                cb({error: "error"});
            } else {
                cb({status: res.status, session: res.body});
            }
        });
}

function relogin() {
    setTimeout(login(function (result) { //this is causing the crash
        if (result.status !== 200) {
            setTimeout(relogin, 240000);
            //Notify the user somehow? Unable to get a login...
        } else {
            session = result.session;
            keepPolling();
        }
    }), 240000);
}

function start() {
    var options = {
        server: {socketOptions: {keepAlive: 300000, connectTimeoutMS: 30000}},
        replset: {socketOptions: {keepAlive: 300000, connectTimeoutMS: 30000}}
    };

    mongoose.connect(process.env.MONGO_URI, options);
    var conn = mongoose.connection;
    mongoose.Promise = global.Promise;

    conn.on('error', console.error.bind(console, 'connection error:'));

    conn.once('open', function () {
        console.log('Connected to Mongo... Starting Express');
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({extended: true}));
        app.use(function (req, res, next) {
            console.log('Getting a request...');
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
            res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE");
            next();
        });
        app.use('/', routes);
        app.set('port', 3000);
        server = app.listen(app.get('port'), function () {
            console.log('Express server listening on port ' + server.address().port);
        });
        keepPolling();
    });
}

function keepPolling() {
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
                setTimeout(keepPolling, 30000);
                nextCall = new Date(now + 30000);
                update.doUpdate('no data');
            } else {
                dexData.setLastEntry(moment.tz(result.time, "America/Chicago").format());
                update.setLastEntry(dexData.lastEntry);
                console.log('Last reading at ' + dexData.lastEntry);
                console.log(dexData.next + ' milliseconds until next call.');
                setTimeout(keepPolling, dexData.next);
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


module.exports = app;