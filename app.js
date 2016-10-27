var request = require('superagent');
var moment = require('moment-timezone');
var express = require('express');
var app = express();
var crypto = require('crypto');
var sys = require('sys');
var exec = require('child_process').exec;
var bodyParser = require('body-parser');
var router = express.Router();
var _ = require('lodash');
var mongoose = require('mongoose');
var auth = require('./auth');
var Token = require('./models/token');
var session;
var nextCall;
var glucose;
var lastEntry;
var next;
var trend;
var eventId = 0;
var clientId = 0;
var clients = {};
const env = require('env2')('./env.json');
var check = require('./paramchecker');
var Reading = require('./models/reading');

//console.log(check.check());
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
            if (res.status == 200) {
                cb({status: res.status, session: res.body});
            } else {
                console.log('Error');
                console.log(err);
                console.log('Response ');
                console.log(res);
                cb({error: "error"});
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
        app.set('port', 3000);
        app.get('/', init);
        app.get('/update', update);
        app.post('/github', github);
        app.get('/secure', auth.isAuthenticated, secureThing);
        app.delete('/logout/:token', auth.isAuthenticated, logout);
        app.post('/login', userLogin);
        app.get('/history', allHistory);
        var server = app.listen(app.get('port'), function () {
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
                Reading.addReading(result.time, glucose);
                doUpdate('regular update');
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

function init(req, res) {
    var query = Reading.find({time: {$gte: Date.now() - (3 * 60 * 60 * 1000)}}).sort({time: 1});
    var promise = query.exec();
    promise.then(function (readings) {
        res.json({glucose: readings, trend: trend, lastEntry: new Date(lastEntry), next: next});
    })
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
    if (req.headers['last-event-id'] == lastEntry.getTime()) {
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
    var event;
    var last = new Date(lastEntry).toISOString();
    if (type === 'regular update') {
        event = "event: update\n";
    }
    if (type === 'no data') {
        event = "event: nodata\n";
    }
    for (clientId in clients) {
        clients[clientId].write("id: " + lastEntry.getTime() + "\n");
        clients[clientId].write(event);
        clients[clientId].write("data: " + "{\"glucose\": " + glucose + ", \"trend\": " + trend + ", \"lastEntry\": \"" + last + "\", \"next\": " + next + "} \n\n");
    }
}

function github(req, res) {
    var
        hmac,
        calculatedSignature,
        payload = req.body;

    hmac = crypto.createHmac('sha1', process.env.DEXCOM_PASSWORD);
    hmac.update(JSON.stringify(payload));
    calculatedSignature = 'sha1=' + hmac.digest('hex');

    if (req.headers['x-hub-signature'] === calculatedSignature) {
        console.log('all good');
        res.status(200);
        if (payload.repository.name == 'dexcom-share-client') {
            function puts(error, stdout, stderr) {
                sys.puts(stdout)
            }

            exec("echo " + process.env.DEXCOM_PASSWORD + " | sudo -S /home/evan/dexcom-share-messenger/upgradeclient.sh", puts);
        } else if (payload.repository.name == 'dexcom-share-messenger') {
            function puts(error, stdout, stderr) {
                sys.puts(stdout)
            }

            exec("echo " + process.env.DEXCOM_PASSWORD + " | sudo -S /home/evan/dexcom-share-messenger/upgradeserver.sh", puts);
        }
    } else {
        console.log('not good');
        res.status(401).send({message: "unauthorized"});
    }
}

function secureThing(req, res) {
    res.json({message: "O'tay!"});
}

function userLogin(req, res) {
    if (req.body.password === process.env.DEXCOM_PASSWORD) {
        Token.issueToken(function (t) {
            res.json(t);
        });
    } else {
        res.statusCode = 401;
        res.send('Invalid password.');
    }
}

function logout(req, res) {
    Token.findOneAndRemove({'token': req.params.token}, function (err) {
        if (!err) {
            res.json({message: 'logged out'});
        } else {
            res.json({message: err});
        }
    });
}
function allHistory(req, res) {

}
