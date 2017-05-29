var Reading = require('../models/reading');
var dexData = require('../dexData');
var moment = require('moment-timezone');

exports.index = function (req, res) {
    if (!('days' in req.query)) {
        var errs = [];
        errs.push('Must have a days parameter in the request.');
        res.json({errors: errs});
    } else if (req.query.days % 1 !== 0) {
        var errs = [];
        errs.push('The days parameter must be a number.');
        res.json({errors: errs});
    } else if (req.query.days < 1 || req.query.days > 90) {
        var errs = [];
        errs.push('The days parameter must be between 1 and 90.');
        res.json({errors: errs});
    } else {
        getReadings(req.query.days, function (readings) {
            res.json({history: readings});
        })
    }
};

function getReadings(numDays, cb) {
    //Send back the newest first...
    var yesterday = new moment.tz(process.env.TZ);
    yesterday.set({hour: 23, minute: 59, second: 59, millisecond: 0});
    yesterday = yesterday.add(-1, 'days');
    var startDay = new moment.tz(process.env.TZ);
    startDay = startDay.add(-1 * numDays, 'days');
    startDay.set({hour: 0, minute: 0, second: 0, millisecond: 0});
    Reading.find({time: {$gte: startDay, $lte: yesterday}}).sort({time: -1}).exec(function (err, readings) {
        var r = [];
        for (var x = 0; x < readings.length; x++) {
            r.push(readings[x]._doc);
        }
        cb(r);
    });
}