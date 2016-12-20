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
            }
            follower.find(params, function (err, f) {
                cb(null, f);
            })
        },
        function (followers, cb) {
            //Have an array of followers who have not expired and filtered based on whether they should receive alerts on weekends and holidays if indeed it is a weekend or holiday
            var message = new Message({eventType: [], followersNotified: [], acknowledged: false});
            _.each(followers, function (follower) {
                _.each(follower.timeBand, function (tb) {
                    if ((tb.startHour < hour && tb.endHour > hour) ||
                        (tb.startHour === hour && tb.startMinute >= minute) ||
                        (tb.endHour === hour && tb.endMinute <= minute)) {
                        // We find a timeband relevant to the given time
                        _.each(tb.event, function (e) {
                            var found = false;

                            if (e.type === 'low' && glucose <= e.glucose) {
                                if (message.eventType.indexOf('low') === -1) {
                                    message.eventType.push('low');
                                }
                                message.followersNotified.push({follower: follower._id, action: e.action});
                                found = true;
                            }

                            if (e.type === 'high' && glucose >= e.glucose) {
                                if (message.eventType.indexOf('high') === -1) {
                                    message.eventType.push('high');
                                }
                                message.followersNotified.push({follower: follower._id, action: e.action});
                                found = true;
                            }

                            if (e.type === 'double up' && trend === 1) {
                                if (message.eventType.indexOf('double up') === -1) {
                                    message.eventType.push('double up');
                                }
                                if (!found) {
                                    message.followersNotified.push({follower: follower._id, action: e.action});
                                    found = true;
                                }
                            }

                            if (e.type === 'double down' && trend === 7) {
                                if (message.eventType.indexOf('double up') === -1) {
                                    message.eventType.push('double up');
                                }
                                if (!found) {
                                    message.followersNotified.push({follower: follower._id, action: e.action});
                                    found = true;
                                }
                            }

                            if (e.type === 'no data' && (date - dexData.lastEntry) > e.noDataTime) {
                                if (message.eventType.indexOf('no data') === -1) {
                                    message.eventType.push('no data');
                                }
                                if (!found) {
                                    message.followersNotified.push({follower: follower._id, action: e.action});
                                    found = true;
                                }
                            }
                        });
                    }
                });
            });
            cb(null, message);
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
                                            url: 'https://www.thezlotnicks.com/twiml'
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
