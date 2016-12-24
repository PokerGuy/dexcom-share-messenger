var async = require('async');
var follower = require('../models/follower');
var message = require('../models/message');
var client = require('twilio')(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);

exports.receive = function (req, res) {
    if (req.body.AccountSid != process.env.ACCOUNT_SID) {
        res.status(401).send('Access.... Denied!');
    } else {
        async.waterfall([
                function (cb) {
                    //Figure out who is sending this message...
                    var phone = parseInt(req.body.From.substring(2, 12));
                    console.log('received a msg from ' + phone);
                    follower.find({
                        phoneNumber: phone
                    }, function (err, f) {
                        if (err) {
                            cb('error finding follower');
                        } else {
                            if (f.length == 1) {
                                cb(null, f[0]);
                            } else {
                                cb('could not find follower');
                            }
                        }
                    });
                },
                function (f, cb) {
                    //Now find the last known message for this follower...
                    console.log(f._id);
                    message.find({
                        'followersNotified.follower': {$eq: f._id},
                        acknowledged: {$eq: false}
                    })
                        .limit(1)
                        .sort({dateTime: -1})
                        .populate('followersNotified.follower')
                        .exec(function (err, msg) {
                            if (err) {
                                cb('Error finding last message');
                            } else {
                                if (msg.length != 1) {
                                    cb('Could not find a message');
                                } else {
                                    cb(null, f, msg[0]);
                                }
                            }
                        })
                },
                function(f, msg, cb) {
                    var msgSentTo = '';
                    var type;
                    if (msg.eventType.length == 1) {
                        type = msg.eventType[0];
                    } else {
                        type = msg.eventType[0] + ' and ' + msg.eventType[1]; //OK, this is hack but there really shouldn't be a high AND a low on the same message, the reality is there could be a low and double down event so I'm not going to iterate here even though I could
                    }
                    async.each(msg.followersNotified, function(follower, done) {
                        var thisFollower = follower.follower;
                        if (process.env.NODE_ENV != 'testing') {
                            if (thisFollower.phoneNumber != f.phoneNumber) {
                                if (msgSentTo.length == 0) {
                                    msgSentTo += thisFollower.name;
                                } else {
                                    msgSentTo += ', ' + thisFollower.name;
                                }
                                console.log('texting... this follower:');
                                console.log('f.phoneNumber ' + f.phoneNumber);
                                console.log('thisFollower.phoneNumber ' + thisFollower.phoneNumber);
                                console.log(thisFollower);
                                console.log('the phone number is ' + thisFollower.phoneNumber);
                                console.log('the body is ' + 'The ' + type + ' event has been acknowledged by ' + f.name);
                                client.sendMessage({
                                    to: '+1' + thisFollower.phoneNumber.toString(),
                                    from: process.env.TWILIO_NUMBER,
                                    body: 'The ' + type + ' event has been acknowledged by ' + f.name
                                }, function (err, responseData) {
                                    console.log('Error from twilio');
                                    console.log(err);
                                    done();
                                })
                            } else {
                                done();
                            }
                        } else {
                            done();
                        }
                    }, function(err) {
                        cb(null, msg, msgSentTo, f);
                    });
                },
                function(msg, msgSentTo, f, cb) {
                    msg.acknowledged = true;
                    msg.save(function(err) {
                        console.log('updated the msg to acknowledged');
                        if (process.env.NODE_ENV != 'testing') {
                            client.sendMessage({
                                to: '+1' + f.phoneNumber.toString(),
                                from: process.env.TWILIO_NUMBER,
                                body: 'You have sent an acknowledgement to ' + msgSentTo
                            }, function (err, responseData) {
                                console.log('Error ' + err);
                                cb(null, 'done');
                            });
                        } else {
                            cb(null, 'done');
                        }
                    })
                }
            ],
            function (err, result) {
                console.log(err);
                console.log(result);
                console.log('send the response');
                res.json({message: "O'tay!"});
            }
        );
    }
};
