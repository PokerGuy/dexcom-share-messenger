require('dotenv').load();
var request = require('superagent');
var sys = require('util');
var bodyParser = require('body-parser');
var session;
var nextCall;
var dexData = require('./dexData');
var check = require('./paramchecker');
var dexcom = require('./dexcom');
var mongoose = require('mongoose');
var express = require('express');
var routes = require('./routes');
var app = express();
var update = require('./controllers/update');

check.check(function (pass) {
    if (!pass) {
        console.log('Please fix the env.json file and restart...');
        process.exit();
    }
});

dexcom.login();
var options = {
    server: {socketOptions: {keepAlive: 300000, connectTimeoutMS: 30000}},
    replset: {socketOptions: {keepAlive: 300000, connectTimeoutMS: 30000}}
};

mongoose.connect(process.env.MONGO_URI, options);
var conn = mongoose.connection;
mongoose.Promise = global.Promise;

conn.on('error', console.error.bind(console, 'connection error:'));
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
app.set('port', process.env.PORT);
var server = app.listen(app.get('port'), function () {
    console.log('Express server listening on port ' + server.address().port);
});


module.exports = server;