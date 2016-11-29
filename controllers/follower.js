require('dotenv').load();
var Follower = require('../models/follower');

exports.create = function (req, res) {
    Follower.create(req.body, function (err, f) {
        if (f) {
            res.json({follower: f});
        } else {
            var errs = [];
            if (!err.errors) {
                errs.push(err.message);
            }
            for (var key in err.errors) {
                if (err.errors.hasOwnProperty(key)) {
                    errs.push(err.errors[key].message);
                }
            }
            res.json({errors: errs});
        }
    })
};

exports.delete = function (req, res) {
    Follower.findOneAndRemove({_id: req.params.id}, function (err, f) {
        if (f) {
            f.remove();
            res.json({message: "Follower removed"});
        } else {
            res.json({errors: ["something bad happened."]});
        }
    });
};

exports.addTimeBand = function (req, res) {
    Follower.findOne({_id: req.params.id}, function (err, follower) {
        if (follower) {
            follower.timeBand.push(req.body);
            follower.save(function (err) {
                if (!err) {
                    res.json({follower: follower});
                } else {
                    var errs = [];
                    if (!err.errors) {
                        errs.push(err.message);
                    }
                    for (var key in err.errors) {
                        if (err.errors.hasOwnProperty(key)) {
                            errs.push(err.errors[key].message);
                        }
                    }
                    res.json({errors: errs});
                }
            })
        } else {
            res.json({errors: ["Follower could not be found"]});
        }
    })
};

exports.addEvent = function (req, res) {
    Follower.update({_id: req.params.followerId, 'timeBand._id': req.params.timebandId}, {
        $push: {'timeBand.$.event': req.body}
    }, {upsert: true}, function (err, docs) {
        if (docs) {
            Follower.findOne({_id: req.params.followerId}, function (err, follower) {
                res.json({follower: follower});
            });
        } else {
            res.json({errors: [err]});
        }
    });
};

exports.deleteTimeBand = function (req, res) {
    Follower.findOne({_id: req.params.followerId}, function (err, follower) {
        if (follower) {
            follower.timeBand.pull(req.params.timebandId);
            follower.save(function (err) {
                if (!err) {
                    res.json({follower: follower});
                } else {
                    res.json({errors: [err]});
                }
            });
        } else {
            res.json({errors: ["Could not find follower"]});
        }
    })
};

exports.deleteEvent = function (req, res) {
    var follower = Follower.findOne({_id: req.params.followerId}, function (err, follower) {
        if (follower) {
            var timeBand = follower.timeBand.id(req.params.timebandId);
            if (timeBand) {
                var event = timeBand.event.id(req.params.eventId);
                if (event) {
                    event.remove();
                    follower.save(function (err) {
                        if (!err) {
                            res.json({follower: follower});
                        } else {
                            res.json({errors: [err]});
                        }
                    })
                } else {
                    res.json({errors: ["Could not find the specified timeband"]});
                }
            }
        } else {
            res.json({errors: ["Could not find the specified follower"]});
        }
    });
};

exports.index = function(req, res) {
    Follower.find({}, function(err, followers) {
        res.json(followers);
    })
};