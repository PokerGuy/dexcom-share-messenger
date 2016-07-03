var request = require('superagent');
var moment = require('moment-timezone');
var express = require('express');
var app = express();
var crypto = require('crypto');
var bodyParser = require('body-parser');
var router = express.Router();
var _ = require('lodash');
var session;
var nextCall;
var glucose;
var lastEntry;
var next;
var trend;
var eventId = 0;
var clientId = 0;
var clients = {};

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

function login(cb) {
    request
        .post('https://share1.dexcom.com/ShareWebServices/Services/General/LoginPublisherAccountByName')
        .send({password: password, applicationId: 'd89443d2-327c-4a6f-89e5-496bbb0317db', accountName: username})
        .set('User-Agent', 'Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .end(function (err, res) {
            if (res.status == 200) {
                cb({status: res.status, session: res.body});
            } else {
                console.log('Error');
                console.log(err);
                console.log('Response ');
                console.log(res);
                relogin();
            }
        });
}

function relogin() {
    setTimeout(login(function (result) {
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
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(function (req, res, next) {
        console.log('Getting a request...');
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });
    app.set('port', 3000);
    app.get('/', init);
    app.get('/update', update);
    app.post('/github', github);
    var server = app.listen(app.get('port'), function () {
        console.log('Express server listening on port ' + server.address().port);
    });
    keepPolling();
}

function keepPolling() {
    getGlucose(function (result) {
        glucose = result.value;
        lastEntry = new Date(result.time);
        trend = result.trend;
        var now = new Date();
        var timeElapsed = now - result.time;
        next = 300000 - timeElapsed;
        next += 60000; //Give it about a minute for the data to get into the Share service...
        if (next < 0) {
            console.log('New value not available, waiting another 30 seconds');
            setTimeout(keepPolling, 30000);
            nextCall = new Date(now + 30000);
            doUpdate('no data');
        } else {
            console.log('Last reading at ' + moment.tz(result.time, "America/Chicago").format());
            console.log(next + ' milliseconds until next call.');
            setTimeout(keepPolling, next);
            nextCall = new Date(now + next);
            doUpdate('regular update');
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

function init(req, res) {
    res.json({glucose: glucose, trend: trend, lastEntry: new Date(lastEntry), next: next});
}

function update(req, res) {
    console.log('update called');
    req.socket.setTimeout(0);
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*'
    });
    res.write('\n');
    if (req.headers['last-event-id'] == eventId) {
        res.write('\n'); //This is either a new request or the client lost contact with the server briefly but is still in synch
    } else {
        //The client is out of synch, tell it to refresh itself with an SSE
        res.write('event: synch\n');
        res.write('data: Need to do a sync\n\n');
    }
    (function (clientId) {
        clients[clientId] = res;
        req.on('close', function () {
            console.log('later skater');
            delete clients[clientId]
        });
    })(++clientId)
}

function doUpdate(type) {
    eventId++;
    var event;
    var last = new Date(lastEntry).toISOString();
    if (type === 'regular update') {
        event = "event: update\n";
    }
    if (type === 'no data') {
        event = "event: nodata\n";
    }
    for (clientId in clients) {
        clients[clientId].write("id: " + eventId + "\n");
        clients[clientId].write(event);
        clients[clientId].write("data: " + "{\"glucose\": " + glucose + ", \"trend\": " + trend + ", \"lastEntry\": \"" + last + "\", \"next\": " + next + "} \n\n");
    }
}

function github(req, res) {
    console.log(req.res);
    console.log('is this the request body payload?');
    console.log(req.res.body);
    var body = JSON.parse(req.res.body);
    var hash = crypto.createHmac('sha1', password).update(body).digest('hex');
    console.log('Update from github headers.....');
    console.log(req.headers['X-Hub-Signature']);
    console.log('all headers');
    console.log(req.headers);
    console.log('hex from body encrypted with the password');
    console.log(hash);
}
