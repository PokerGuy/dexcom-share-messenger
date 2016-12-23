var Message = require('./models/message');
var follower = require('./models/follower');
var _ = require('lodash');
var moment = require('moment-timezone');
var client = require('twilio')(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);
var ObjectId = require('mongoose').Types.ObjectId;
var dexData = require('./dexData');
var vacation = require('./models/vacation');
var async = require('async');

exports.sendMessages = function (date, glucose, trend, done) {
    //Wait... Why, why would someone pass in the date as a parameter?!? It's for testing, I want to be able to throw different dates in
    //and see how the system reacts. It's easy enough to grab the current time when not testing and throw it in as a parameter, but it makes simulating situations way easier for mocha (testing)
    var toDate = new Date(date);
    var hour = new moment.tz(date, process.env.TZ).get('hour');// date.get('hour');
    var minute = new moment.tz(date, process.env.TZ).get('minute');
    async.waterfall([
        function (cb) {
            //Is today a vacation day?
            vacation.find({
                startDate: {$lte: toDate},
                endDate: {$gte: toDate}
            }, function (err, v) {
                cb(null, v.length);
            })
        },
        function (vacaInd, cb) {
            //Is today a weekend?
            var params = {expirationDate: {$gt: date}};
            var dow = new moment.tz(date, process.env.TZ).get('day');
            if (dow === 0 || dow === 6 || vacaInd > 0) {
                params = {expirationDate: {$gt: date}, includeWeekendsAndHolidays: {$eq: true}};
                showFollowers = true;
            }
            follower.find(params, function (err, f) {
                cb(null, f);
            })
        },
        function (followers, cb) {
            //Have an array of followers who have not expired and filtered based on whether they should receive alerts on weekends and holidays if indeed it is a weekend or holiday
            var poss = [];
            _.each(followers, function (follower) {
                _.each(follower.timeBand, function (tb) {
                    if ((tb.startHour < hour && tb.endHour > hour) ||
                        (tb.startHour === hour && tb.startMinute <= minute) ||
                        (tb.endHour === hour && tb.endMinute >= minute)) {
                        // We find a timeband relevant to the given time
                        _.each(tb.event, function (e) {

                            if (e.type === 'low' && glucose <= e.glucose) {
                                poss.push({
                                    eventType: 'low',
                                    followerId: follower._id,
                                    repeat: e.repeat,
                                    action: e.action
                                });
                            }

                            if (e.type === 'high' && glucose >= e.glucose) {
                                poss.push({
                                    eventType: 'high',
                                    followerId: follower._id,
                                    repeat: e.repeat,
                                    action: e.action
                                });
                            }

                            if (e.type === 'double up' && trend === 1) {
                                poss.push({
                                    eventType: 'double up',
                                    followerId: follower._id,
                                    repeat: e.repeat,
                                    action: e.action
                                });
                            }

                            if (e.type === 'double down' && trend === 7) {
                                poss.push({
                                    eventType: 'double down',
                                    followerId: follower._id,
                                    repeat: e.repeat,
                                    action: e.action
                                });

                            }

                            if (e.type === 'no data' && (date - dexData.lastEntry) > e.noDataTime) {
                                poss.push({
                                    eventType: 'no data',
                                    followerId: follower._id,
                                    repeat: e.repeat,
                                    action: e.action
                                });
                            }
                        });
                    }
                });
            });
            cb(null, poss);
        },
        function (possMessages, cb) {
            var message = new Message({eventType: [], followersNotified: [], acknowledged: false});
            async.each(possMessages, function (msg, callback) {
                if (msg.eventType == 'low' && message.eventType.indexOf('low') == -1) {
                    message.eventType.push('low');
                }
                if (msg.eventType == 'high' && message.eventType.indexOf('high') == -1) {
                    message.eventType.push('high');
                }
                if (msg.eventType == 'double up' && message.eventType.indexOf('double up') == -1) {
                    message.eventType.push('double up');
                }
                if (msg.eventType == 'double down' && message.eventType.indexOf('double down') == -1) {
                    message.eventType.push('double down');
                }
                if (msg.eventType == 'no data' && message.eventType.indexOf('no data') == -1) {
                    message.eventType.push('no data');
                }
                if (message.followersNotified.indexOf({follower: msg.followerId, action: msg.action}) == -1) {
                    Message.find({
                        'followersNotified.follower': {$eq: msg.followerId},
                        eventType: {$in: [msg.eventType]}
                    }).limit(1).sort({dateTime: -1}).exec(function (err, m) {
                        if (m.length == 1) {
                            console.log(m[0]._doc.dateTime.getTime());
                            console.log('found a previous message');
                            console.log('date is ' + date);
                            console.log('The time elapsed is ' + (date - m[0]._doc.dateTime));
                            console.log('the time required to trigger another event is ' + msg.repeat);
                            if ((date - m[0]._doc.dateTime) > msg.repeat) {
                                message.followersNotified.push({follower: msg.followerId, action: msg.action});
                            }
                        } else {
                            message.followersNotified.push({follower: msg.followerId, action: msg.action});
                        }
                        callback();
                    })
                } else {
                    callback();
                }
            }, function (err) {
                cb(null, message);
            })
        }
    ], function (err, message) {
        // We have done all the iterating in the world, time to save the message and make calls to twilio
        if (message.followersNotified.length > 0) {
            message.dateTime = new Date();
            message.save(function (err) {
                if (!err && process.env.NODE_ENV != 'testing') {
                    var type;
                    if (message.eventType.length == 1) {
                        type = message.eventType[0];
                    } else {
                        type = message.eventType[0] + ' and ' + message.eventType[1]; //OK, this is hack but there really shouldn't be a high AND a low on the same message, the reality is there could be a low and double down event so I'm not going to iterate here even though I could
                    }
                    dexData.setEventType(type);
                    Message.findOne({_id: message._id})
                        .populate('followersNotified.follower')
                        .exec(function (err, f) {
                            _.each(f.followersNotified, function (toNotify) {
                                if (toNotify.action === 'text' || toNotify.action === 'call/text') {
                                    client.sendMessage({
                                        to: '+1' + toNotify.follower.phoneNumber.toString(),
                                        from: process.env.TWILIO_NUMBER,
                                        body: type + ' alert for ' + process.env.CHILD_NAME + '. Current glucose is ' + glucose + '.'
                                    }, function (err, responseData) {
                                        console.log('Error from twilio');
                                        console.log(err);
                                    })
                                }
                                if (toNotify.action === 'call' || toNotify.action === 'call/text') {
                                    client.makeCall({
                                            to: '+1' + toNotify.follower.phoneNumber.toString(),
                                            from: process.env.TWILIO_NUMBER,
                                            url: 'https://www.thezlotnicks.com/api/twiml'
                                        }, function (err, responseDate) {
                                            console.log(responseDate);
                                        }
                                    )
                                }
                            })
                        });
                }
                done(message);
            })
        } else {
            done(message);
        }
    });
};
