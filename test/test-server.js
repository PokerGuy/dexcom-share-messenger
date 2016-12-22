var dotenv = require('dotenv').config({path: '/Users/evan/dexcom-share-messenger/.env.testing'});
var chai = require('chai');
var chaiHttp = require('chai-http');
var server = require('../app');
var mongoose = require('mongoose');
var routes = require('../routes');
var should = chai.should();
var express = require('express');
var app = express();
var token = require('../models/token');
var moment = require('moment-timezone');
var m = require('moment');
var vacation = require('../models/vacation');
var follower = require('../models/follower');
var token = require('../models/token');
var messenger = require('../messenger');
var message = require('../models/message');
var dex = require('../dexData');
var validToken;
var vacaId;
var followerId;
var followerId2;
var timebandId;
var timebandId2;
var timebandId3;
var eventId;
var nextNonHolidayMonday;

chai.use(chaiHttp);

var findNextNonHolidayMonday = function (startPoint, cb) {
    if (startPoint.day() === 0) {
        startPoint.add(1, 'day');
    } else {
        startPoint.add((8 - startPoint.day()), 'days');
    }
    console.log('After adding days its ' + startPoint.format());
    // it's now next Monday, check to see if it's a holiday or keep iterating...
    vacation.find({
        startDate: {$gte: startPoint.unix()},
        endDate: {$lte: startPoint.unix()}
    }, function (err, v) {
        console.log(v.length);
        if (v.length === 0) {
            console.log('next non holiday Monday is ' + startPoint.format());
            //Create the very important Holiday 'Me Day' as the next Monday
            var copy = startPoint;
            var meDay = copy.add(7, 'days').utc();
            vacation.create({
                startDate: meDay.month() + 1 + '/' + meDay.date() + '/' + meDay.year(),
                endDate: meDay.month() + 1 + '/' + meDay.date() + '/' + meDay.year(),
                name: "Me Day!"
            }, function (err, v) {
                console.log(v);
                cb(startPoint);
            });
        } else {
            findNextNonHolidayMonday(startPoint);
        }
    });
};

describe('API Tests', function () {
    before(function (done) {
        var con = mongoose.connect(process.env.MONGO_URI);
        mongoose.connection.on('open', function () {
            con.connection.db.dropDatabase(function (err, result) {
                console.log('DROPPING DATABASE');
                var d = new Date();
                d -= (24 * 2 * 60 * 60 * 1000);
                d = new Date(d).toISOString();
                token.create({token: "abdefg", lastUsed: d}, function (err, token) {
                });
                var currYear = new Date().getFullYear();
                vacation.create({
                    startDate: "12/31/" + currYear,
                    endDate: "12/31/" + currYear,
                    name: "New Year\'s Eve"
                }, function (err, vaca) {
                    vacaId = vaca._id;
                });
                token.issueToken(function (t) {
                    validToken = t.token;
                });
                follower.create({
                    name: "Evan", phoneNumber: 4255551212, timeBand: [
                        {
                            startHour: 0,
                            endHour: 6,
                            event: [
                                {
                                    type: "low",
                                    glucose: 80,
                                    action: "call",
                                    repeat: 900000
                                },
                                {
                                    type: "high",
                                    glucose: 250,
                                    action: "text",
                                    repeat: 900000
                                }
                            ]
                        },
                        {
                            startHour: 6,
                            endHour: 12,
                            event: [
                                {
                                    type: "high",
                                    glucose: 300,
                                    action: "call",
                                    repeat: 900000
                                }
                            ]
                        }]
                }, function (err, f) {
                    followerId = f._id;
                    timebandId = f.timeBand[1]._id;
                    timebandId3 = f.timeBand[0]._id;
                    eventId = f.timeBand[0].event[0]._id;
                });
                follower.create({
                    name: "Allan", phoneNumber: 5125551212, includeWeekendsAndHolidays: false, timeBand: [
                        {
                            startHour: 0,
                            endHour: 6,
                            event: [
                                {
                                    type: "low",
                                    glucose: 80,
                                    action: "call",
                                    repeat: 900000
                                },
                                {
                                    type: "high",
                                    glucose: 250,
                                    action: "text",
                                    repeat: 900000
                                }
                            ]
                        },
                        {
                            startHour: 6,
                            endHour: 12,
                            event: [
                                {
                                    type: "high",
                                    glucose: 300,
                                    action: "call",
                                    repeat: 900000
                                }
                            ]
                        }]
                }, function (err, f) {
                    console.log('Alan created');
                });
            });
        });
        var today = new moment.tz(process.env.TZ);
        console.log('Right now is ' + today.format());
        today.set({hour: 6, minute: 0, second: 0, millisecond: 0}); //6 in the morning police at my door...
        console.log(moment.tz(today, process.env.TZ).format('HH:mm'));
        findNextNonHolidayMonday(today, function (nonHolidayMonday) {
            nextNonHolidayMonday = nonHolidayMonday.add(-7, 'days');
            done();
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
                    done();
                })
        });
    });

    describe('Secure thing', function () {
        it('Should receive a 401 when an invalid token is provided', function (done) {
            chai.request(server)
                .get('/secure')
                .set('Authorization', 'Bearer bad_token')
                .end(function (err, res) {
                    res.should.have.status(401);
                    done();
                })
        });
        it('Should receive a 200 when a valid token is provided', function (done) {
            chai.request(server)
                .get('/secure')
                .set('Authorization', 'Bearer ' + validToken)
                .end(function (err, res) {
                    res.should.have.status(200);
                    done();
                })
        });
    });

    describe('Continuous integration', function () {
        it('Should verify that it is actually github sending the post', function (done) {
            chai.request(server)
                .post('/github')
                .set('x-hub-signature', 'abdefg')
                .send({resposity: {name: 'dexcom-share-messenger'}})
                .end(function (err, res) {
                    res.should.have.status(401);
                    done();
                })
        });
    });

    describe('Maintain vacation days', function () {
        it('Should receive a 401 when an invalid token is provided', function (done) {
            chai.request(server)
                .get('/vacation')
                .set('Authorization', 'Bearer abcdefg')
                .end(function (err, res) {
                    res.should.have.status(401);
                    done();
                })
        });
        it('Should deny an old token', function (done) {
            chai.request(server)
                .get('/vacation')
                .set('Authorization', 'Bearer abdefg')
                .end(function (err, res) {
                    res.should.have.status(401);
                    done();
                })
        });
        it('Should send back an array of objects with a valid token', function (done) {
            chai.request(server)
                .get('/vacation')
                .set('Authorization', 'Bearer ' + validToken)
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.should.be.a('array');
                    done();
                })
        });
        it('Should not create a vacation day that does not have a start and an end date', function (done) {
            chai.request(server)
                .post('/vacation')
                .set('Authorization', 'Bearer ' + validToken)
                .send({start: '11/11/2016'})
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.errors.should.be.a('array');
                    done();
                })
        });
        it('Should not create a vacation day that does not have valid dates or a name', function (done) {
            chai.request(server)
                .post('/vacation')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({startDate: 'lebron james', endDate: 'kobe bryant'})
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.errors.should.be.a('array');
                    done();
                })
        });
        it('Should require the end date to be after the start date', function (done) {
            chai.request(server)
                .post('/vacation')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({startDate: '11/11/2016', endDate: '10/31/2016'})
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.errors.should.be.a('array');
                    done();
                })
        });
        it('Should require the start date to be in the future', function (done) {
            var pastDate = (new Date().getDate() - 3);
            chai.request(server)
                .post('/vacation')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({startDate: pastDate, endDate: new Date().getDate(), name: 'Me Day'})
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.errors.should.be.a('array');
                    done();
                })
        });
        it('Should allow a valid vacation day to be created. The start time should be midnight local and the end time should be 11:59PM local', function (done) {
            var nextYear = new Date().getFullYear();
            nextYear += 1;
            chai.request(server)
                .post('/vacation')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({startDate: '11/11/' + nextYear, endDate: '11/15/' + nextYear, name: 'Veteran\'s Day'})
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.vacation.should.be.a('object');
                    var s = new Date(moment.tz(res.body.vacation.startDate, process.env.TZ).format()).getHours();
                    s.should.equal(0);
                    var e = new Date(moment.tz(res.body.vacation.endDate, process.env.TZ).format());
                    e.getHours().should.equal(23);
                    e.getMinutes().should.equal(59);
                    e.getSeconds().should.equal(59);
                    done();
                })
        });
        it('Should not allow a start date to be between another holidays start and end date', function (done) {
            var nextYear = new Date().getFullYear();
            nextYear += 1;
            chai.request(server)
                .post('/vacation')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({startDate: '11/12/' + nextYear, endDate: '11/14/' + nextYear, name: 'something and stuff'})
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.errors.should.be.a('array');
                    done();
                })
        });
        it('Should not allow an end date to be between another holidays start and end date', function (done) {
            var nextYear = new Date().getFullYear();
            nextYear += 1;
            chai.request(server)
                .post('/vacation')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({startDate: '11/10/' + nextYear, endDate: '11/13/' + nextYear, name: 'something and stuff'})
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.errors.should.be.a('array');
                    done();
                })
        });
        it('Should not allow a time range to be created when an existing holiday is already in the range', function (done) {
            var currYear = new Date().getFullYear();
            nextYear = currYear + 1;
            chai.request(server)
                .post('/vacation')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({startDate: '12/30/' + currYear, endDate: '1/2/' + nextYear, name: 'long new years'})
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.errors.should.be.a('array');
                    done();
                })
        });
        it('Should allow a vacation to be deleted', function (done) {
            chai.request(server)
                .delete('/vacation/' + vacaId)
                .set('Authorization', 'Bearer ' + validToken)
                .end(function (err, res) {
                    res.should.have.status(200);
                    vacation.count(function (err, count) {
                        count.should.equal(2);
                        done();
                    })
                })
        })
    });

    describe('Secure update', function () {
        it('Should receive a 401 when an invalid token is provided', function (done) {
            chai.request(server)
                .get('/secureupdate/abcd')
                .end(function (err, res) {
                    res.should.have.status(401);
                    done();
                });
        });
    });

    describe('Maintain followers', function () {
        it('Should require a follower to have a name of at least two characters', function (done) {
            chai.request(server)
                .post('/follower')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({name: 'J'})
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.errors.should.be.a('array');
                    done();
                })
        });
        it('Should require a timeband to have hours between 0 and 23 and minutes to be between 0 and 59', function (done) {
            chai.request(server)
                .post('/follower')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({
                    name: 'Julie',
                    phoneNumber: 2135551212,
                    timeBand: [{startHour: -2, startMinute: -3, endHour: 25, endMinute: 75}]
                })
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.errors.should.be.a('array');
                    done();
                })
        });
        it('Should require at least one time band', function (done) {
            chai.request(server)
                .post('/follower')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({name: 'Julie', phoneNumber: 6025551212})
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.errors.should.be.a('array');
                    done();
                })
        });
        it('Should require each time band to have one event', function (done) {
            chai.request(server)
                .post('/follower')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({name: 'Julie', phoneNumber: 6925551212, timeBand: [{startHour: 0, endHour: 6}]})
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.errors.should.be.a('array');
                    done();
                })
        });
        it('Should only accept events that are of type double up, double down, low, high, no data', function (done) {
            chai.request(server)
                .post('/follower')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({
                    name: 'Julie',
                    phoneNumber: 3105551212,
                    timeBand: [{startHour: 0, endHour: 6, event: [{type: "seahawks win"}]}]
                })
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.errors.should.be.a('array');
                    done();
                })
        });
        it('Should make two time bands if the end time is before the start time', function (done) {
            chai.request(server)
                .post('/follower')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({
                    name: 'Julie',
                    phoneNumber: 4155551212,
                    timeBand: [{
                        startHour: 22,
                        endHour: 6,
                        event: [
                            {type: "low", glucose: 80, action: "call", repeat: 900000},
                            {type: "high", glucose: 280, action: "call", repeat: 900000},
                            {type: "double up", action: "call", repeat: 900000},
                            {type: "double down", action: "call", repeat: 900000},
                            {type: "no data", action: "call", noDataTime: 1800000, repeat: 1800000}
                        ]
                    }]
                })
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.follower.timeBand.length.should.equal(2);
                    done();
                })
        });
        it('Should default a follower to include weekend and holidays and expire on 12/31/9999', function (done) {
            chai.request(server)
                .post('/follower')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({
                    name: 'Jenny',
                    phoneNumber: 3128675309,
                    timeBand: [{
                        startHour: 0,
                        endHour: 6,
                        event: [{type: "low", glucose: 80, action: "call", repeat: 900000}]
                    }]
                })
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.follower.includeWeekendsAndHolidays.should.equal(true);
                    var expDate = new Date (parseInt(res.body.follower.expirationDate));
                    expDate.getFullYear().should.equal(9999);
                    followerId2 = res.body.follower._id;
                    done();
                })
        });
        it('Should not allow multiple events of the same type in the same time band', function (done) {
            chai.request(server)
                .post('/follower')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({
                    name: 'Evan', phoneNumber: 2065551212, timeBand: [
                        {
                            startHour: 0, endHour: 6, event: [
                            {type: "low", glucose: 80, action: "call", repeat: 900000},
                            {type: "low", glucose: 90, action: "call", repeat: 900000}
                        ]
                        }
                    ]
                })
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.errors.should.be.a('array');
                    done();
                })
        });
        it('Should require numbers to be greater than 40 and less than 400', function (done) {
            chai.request(server)
                .post('/follower')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({
                    name: 'Evan', phoneNumber: 2125551212, timeBand: [
                        {
                            startHour: 0, endHour: 6, event: [
                            {type: "low", glucose: 35, action: "call", repeat: 900000}
                        ]
                        }
                    ]
                })
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.errors.should.be.a('array');
                    done();
                })
        });
        it('Should not allow overlapping time bands', function (done) {
            chai.request(server)
                .post('/follower')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({
                    name: 'Evan', phoneNumber: 7085121212, timeBand: [
                        {
                            startHour: 0, endHour: 6, event: [
                            {type: "low", glucose: 80, action: "call", repeat: 900000}
                        ]
                        },
                        {
                            startHour: 3, endHour: 5, event: [
                            {type: "low", glucose: 100, action: "text", repeat: 900000}
                        ]
                        }
                    ]
                })
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.errors.should.be.a('array');
                    done();
                })
        });
        it('Should allow a timeband to be deleted', function (done) {
            chai.request(server)
                .delete('/follower/' + followerId + '/timeband/' + timebandId)
                .set('Authorization', 'Bearer ' + validToken)
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.follower.timeBand.length.should.equal(1);
                    done();
                })
        });
        it('Should allow an event to be deleted', function (done) {
            chai.request(server)
                .delete('/follower/' + followerId + '/timeband/' + timebandId3 + '/event/' + eventId)
                .set('Authorization', 'Bearer ' + validToken)
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.follower.timeBand[0].event.length.should.equal(1);
                    done();
                })
        });
        it('Should allow a follower to be deleted', function (done) {
            var initCount;
            follower.count(function (err, count) {
                initCount = count;
                chai.request(server)
                    .delete('/follower/' + followerId)
                    .set('Authorization', 'Bearer ' + validToken)
                    .end(function (err, res) {
                        res.should.have.status(200);
                        follower.count(function (err, count) {
                            count.should.equal(initCount - 1);
                            done();
                        })
                    })
            });

        });
        it('Should allow a timeband to be added to a follower', function (done) {
            chai.request(server)
                .post('/follower/' + followerId2 + '/timeband')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({startHour: 10, endHour: 12, event: [{type: "low", glucose: 80, action: "text", repeat: 900000}]})
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.follower.timeBand.length.should.equal(2);
                    timebandId2 = res.body.follower.timeBand[1]._id;
                    done();
                })
        });
        it('Should allow an event to be added to a timeband', function (done) {
            chai.request(server)
                .post('/follower/' + followerId2 + '/timeband/' + timebandId2 + '/event')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({type: "high", glucose: 250, action: "text", repeat: 900000})
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.follower.timeBand[1].event.length.should.equal(2);
                    done();
                })
        });
        it('Should require expiration dates to be in the future', function (done) {
            var yesterday = m(new Date()).add(-2, 'days').toDate();
            var strYesterday = yesterday.getMonth() + 1 + '/' + yesterday.getUTCDate() + '/' + yesterday.getFullYear();
            chai.request(server)
                .post('/follower')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({
                    name: 'Jenny',
                    phoneNumber: 6198675309,
                    expirationDate: strYesterday,
                    timeBand: [{
                        startHour: 0,
                        endHour: 6,
                        event: [{type: "low", glucose: 80, action: "call", repeat: 900000}]
                    }]
                })
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.errors.should.be.a('array');
                    done();
                })
        });
        it('Should make expiration dates expire at midnight local time', function (done) {
            var today = new Date();
            var strToday = today.getMonth() + 1 + '/' + today.getUTCDate() + '/' + today.getFullYear();
            chai.request(server)
                .post('/follower')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .send({
                    name: 'Laura',
                    phoneNumber: 2068675309,
                    expirationDate: strToday,
                    timeBand: [{
                        startHour: 0,
                        endHour: 6,
                        event: [{type: "low", glucose: 80, action: "call", repeat: 900000}]
                    }]
                })
                .end(function (err, res) {
                    res.should.have.status(200);
                    var e = moment.tz(parseInt(res.body.follower.expirationDate), process.env.TZ);
                    e.get('hour').should.equal(23);
                    e.get('minute').should.equal(59);
                    e.get('second').should.equal(59);
                    done();
                })
        });
        it('Should return an array of followers on the index route', function (done) {
            chai.request(server)
                .get('/follower')
                .set('Authorization', 'Bearer ' + validToken)
                .set('Content-type', 'application/json')
                .end(function (err, res) {
                    res.should.have.status(200);
                    res.body.should.be.a('array');
                    done();
                })
        })
    });
    /*
     OK, at this point our followers look like:
     { "_id" : ObjectId("5849fad175944c382f0a5346"), "name" : "Allan", "phoneNumber" : 5125551212, "timeBand" : [ { "startHour" : 0, "endHour" : 6, "_id" : ObjectId("5849fad175944c382f0a5349"), "event" : [ { "type" : "low", "glucose" : 80, "action" : "call", "repeat" : 900000, "_id" : ObjectId("5849fad175944c382f0a534b") }, { "type" : "high", "glucose" : 250, "action" : "text", "repeat" : 900000, "_id" : ObjectId("5849fad175944c382f0a534a") } ], "endMinute" : 0, "startMinute" : 0 }, { "startHour" : 6, "endHour" : 12, "_id" : ObjectId("5849fad175944c382f0a5347"), "event" : [ { "type" : "high", "glucose" : 300, "action" : "call", "repeat" : 900000, "_id" : ObjectId("5849fad175944c382f0a5348") } ], "endMinute" : 0, "startMinute" : 0 } ], "includeWeekendsAndHolidays" : false, "expirationDate" : 253402322399000, "__v" : 0 }
     { "_id" : ObjectId("5849fad275944c382f0a535e"), "name" : "Julie", "phoneNumber" : 4155551212, "timeBand" : [ { "startHour" : 22, "endHour" : 23, "_id" : ObjectId("5849fad275944c382f0a535f"), "event" : [ { "type" : "low", "glucose" : 80, "action" : "call", "repeat" : 900000, "_id" : ObjectId("5849fad275944c382f0a5364") }, { "type" : "high", "glucose" : 280, "action" : "call", "repeat" : 900000, "_id" : ObjectId("5849fad275944c382f0a5363") }, { "type" : "double up", "action" : "call", "repeat" : 900000, "_id" : ObjectId("5849fad275944c382f0a5362") }, { "type" : "double down", "action" : "call", "repeat" : 900000, "_id" : ObjectId("5849fad275944c382f0a5361") }, { "type" : "no data", "action" : "call", "noDataTime" : 1800000, "repeat" : 1800000, "_id" : ObjectId("5849fad275944c382f0a5360") } ], "endMinute" : 59, "startMinute" : 0 }, { "startHour" : 0, "endHour" : 6, "_id" : ObjectId("5849fad275944c382f0a5365"), "event" : [ { "type" : "low", "glucose" : 80, "action" : "call", "repeat" : 900000, "_id" : ObjectId("5849fad275944c382f0a5364") }, { "type" : "high", "glucose" : 280, "action" : "call", "repeat" : 900000, "_id" : ObjectId("5849fad275944c382f0a5363") }, { "type" : "double up", "action" : "call", "repeat" : 900000, "_id" : ObjectId("5849fad275944c382f0a5362") }, { "type" : "double down", "action" : "call", "repeat" : 900000, "_id" : ObjectId("5849fad275944c382f0a5361") }, { "type" : "no data", "action" : "call", "noDataTime" : 1800000, "repeat" : 1800000, "_id" : ObjectId("5849fad275944c382f0a5360") } ], "endMinute" : 0, "startMinute" : 0 } ], "includeWeekendsAndHolidays" : true, "expirationDate" : 253402322399000, "__v" : 0 }
     { "_id" : ObjectId("5849fad275944c382f0a5366"), "name" : "Jenny", "phoneNumber" : 3128675309, "timeBand" : [ { "startHour" : 0, "endHour" : 6, "_id" : ObjectId("5849fad275944c382f0a5367"), "event" : [ { "type" : "low", "glucose" : 80, "action" : "call", "repeat" : 900000, "_id" : ObjectId("5849fad275944c382f0a5368") } ], "endMinute" : 0, "startMinute" : 0 }, { "startHour" : 10, "endHour" : 12, "_id" : ObjectId("5849fad275944c382f0a5375"), "event" : [ { "type" : "low", "glucose" : 80, "action" : "text", "repeat" : 900000, "_id" : ObjectId("5849fad275944c382f0a5376") }, { "type" : "high", "glucose" : 250, "action" : "text", "repeat" : 900000, "_id" : ObjectId("5849fad275944c382f0a5377") } ], "endMinute" : 0, "startMinute" : 0 } ], "includeWeekendsAndHolidays" : true, "expirationDate" : 253402322399000, "__v" : 1 }
     { "_id" : ObjectId("5849fad275944c382f0a537b"), "name" : "Laura", "phoneNumber" : 2068675309, "timeBand" : [ { "startHour" : 0, "endHour" : 6, "_id" : ObjectId("5849fad275944c382f0a537c"), "event" : [ { "type" : "low", "glucose" : 80, "action" : "call", "repeat" : 900000, "_id" : ObjectId("5849fad275944c382f0a537d") } ], "endMinute" : 0, "startMinute" : 0 } ], "includeWeekendsAndHolidays" : true, "expirationDate" : 1481349599000, "__v" : 0 }
     */

    describe('Send messages', function () {
        it('Should send a message to followers with an event type of low if the BG is below the glucose level specified in the event', function (done) {
            //Send a date of next Monday 3AM with a glucose of 70
            //Based on the sample users that are set up Allan, Julie, and Jenny should receive the message
            //The total count of messages should be 3
            console.log(nextNonHolidayMonday);
            var copy = new moment(nextNonHolidayMonday);
            var fiveMinutesAgo = copy.add(-5, "minutes");
            dex.setLastEntry(fiveMinutesAgo);
            messenger.sendMessages(parseInt(nextNonHolidayMonday.format('x')), 70, 4, function (m) {
                m.followersNotified.length.should.equal(3);
                done();
            });
        });

        it('Should send a message to followers with an event type of high if the BG is above the glucose level specified in the event', function (done) {
            //We have 3 messages so far, let's send a high BG on the same date/time, we should get 2 more messages during this time period
            var copy = new moment(nextNonHolidayMonday);
            var fiveMinutesAgo = copy.add(-5, "minutes");
            dex.setLastEntry(fiveMinutesAgo);
            messenger.sendMessages(parseInt(nextNonHolidayMonday.format('x')), 300, 4, function (m) {
                m.followersNotified.length.should.equal(3); //Getting two messages for Alan cuz he has a timeband that ends at exactly 6am and starts at 6am... really edge casey
                done();
            });
        });
        it('Should send a message to followers if they have an event of type double up when a double up happens', function (done) {
            //For those playing at home, we have 5 messages if we use the same time period, and send an event type of double up, we get 1 more message
            messenger.sendMessages(parseInt(nextNonHolidayMonday.format('x')), 150, 1, function (m) {
                //The third parameter of 1 indicates double up
                m.followersNotified.length.should.equal(1);
                done();
            });
        });
        it('Should send a message to followers if they have an event of type double down when a double down happens', function (done) {
            //Starting with an assumed 6 messages, sending a double down should result in 1 more...
            messenger.sendMessages(parseInt(nextNonHolidayMonday.format('x')), 150, 7, function (m) {
                m.followersNotified.length.should.equal(1);
                //The third parameter of 1 indicates double up
                done();
            });
        });
        it('Should send a message to followers if they have an event type of no data and there has been no data for the specified amount of time', function (done) {
            //Let's set the last known entry in the DexData to forty five minutes ago, then send an event in...
            var copy = new moment(nextNonHolidayMonday);
            var fortyFiveMinutesAgo = copy.add(-45, 'minutes');
            dex.setLastEntry(fortyFiveMinutesAgo);
            messenger.sendMessages(parseInt(nextNonHolidayMonday.format('x')), 150, 5, function (m) {
                m.followersNotified.length.should.equal(1);
                done();
            })
        });
        it('Should only send a message to followers who have includeWeekendsAndHolidays if the event happens on a weekend.', function (done) {
            //Still at 8 messages, let's send the first event on a Sunday and we should get two more as Allan is excluded
            var copy = new moment(nextNonHolidayMonday);
            var anyGivenSunday = copy.add(13, 'day'); //making it the day before any Monday made it fail when testing on Sunday, making it the Sunday after me day
            anyGivenSunday.add(-3, 'hours');
            var copy2 = anyGivenSunday;
            var fiveMinutesPrior = copy2.add(-5, 'minutes');
            dex.setLastEntry(fiveMinutesPrior);
            messenger.sendMessages(parseInt(anyGivenSunday.format('x')), 70, 4, function (m) {
                m.followersNotified.length.should.equal(2);
                done();
            })
        });
        it('Should only send a message to followers who have includeWeekendsAndHolidays if the event happens on a vacation period.', function (done) {
            //we know that my fav holiday, me day, is exactly a week from the first non holiday monday, Alan will not get a message on me day, so vis a vi ergo, we should get two more messages if we have a low at 6am on me day
            var copy = new moment(nextNonHolidayMonday);
            var meDay = copy.add(7, 'days');
            var copy = new moment(nextNonHolidayMonday);
            var fiveMinutesAgo = copy.add(-5, 'minutes');
            dex.setLastEntry(fiveMinutesAgo);
            messenger.sendMessages(parseInt(meDay.format('x')), 70, 4, function (m) {
                m.followersNotified.length.should.equal(3); //Getting two messages for Alan cuz he has a timeband that ends at exactly 6am and starts at 6am... really edge casey
                done();
            })
        });
        it('Should not send a message to a follower that has expired', function (done) {
            console.log('The test cases above assume the follower created as Laura expired already');
            done();
        });
    });

});