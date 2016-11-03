var chai = require('chai');
var chaiHttp = require('chai-http');
var server;
var mongoose = require('mongoose');
var routes = require('../routes');
var should = chai.should();
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
const env = require('env2')('./env.json');

chai.use(chaiHttp);
describe('API Tests', function () {
    before(function () {
        var options = {
            server: {socketOptions: {keepAlive: 300000, connectTimeoutMS: 30000}},
            replset: {socketOptions: {keepAlive: 300000, connectTimeoutMS: 30000}}
        };
        mongoose.createConnection('mongodb://localhost/dexcom-test', options);
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

    });

    after(function () {
        mongoose.connection.close();
    });

    describe('Tokens', function () {
        it('Should receive a 401 when an invalid password is provided', function (done) {
            chai.request(server)
                .post('/login')
                .send({"password": "wrong"})
                .end(function (err, res) {
                    res.should.have.status(401);
                    done();
                })
        });
        it('Should receive a 200 when an valid password is provided', function (done) {
            chai.request(server)
                .post('/login')
                .send({"password": process.env.DEXCOM_PASSWORD})
                .end(function (err, res) {
                    res.should.have.status(200);
                    done();
                })
        });
    });

});