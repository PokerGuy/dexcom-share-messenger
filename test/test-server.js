var dotenv = require('dotenv').config({path: '/Users/ezlotnick/WebstormProjects/messenger/.env.testing'});
var chai = require('chai');
var chaiHttp = require('chai-http');
var server = require('../app');
var mongoose = require('mongoose');
var routes = require('../routes');
var should = chai.should();
var express = require('express');
var app = express();
var token;

chai.use(chaiHttp);
describe('API Tests', function () {
    before(function (done) {
        var con = mongoose.connect(process.env.MONGO_URI);
        mongoose.connection.on('open', function(){
            con.connection.db.dropDatabase(function(err, result){
                console.log('DROPPING DATABASE');
                done();
            });
        });
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
                    token = res.body.token;
                    done();
                })
        });
    });

    describe('Secure thing', function() {
        it('Should receive a 401 when an invalid token is provided', function(done) {
            chai.request(server)
                .get('/secure')
                .set('Authorization', 'Bearer abcdefg')
                .end(function (err, res) {
                    res.should.have.status(401);
                    done();
                })
        });
        it('Should receive a 200 when a valid token is provided', function(done) {
            chai.request(server)
                .get('/secure')
                .set('Authorization', 'Bearer ' + token)
                .end(function(err, res) {
                    res.should.have.status(200);
                    done();
                })
        });
    })

});