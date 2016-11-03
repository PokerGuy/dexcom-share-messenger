var Reading = require('../models/reading');
var dexData = require('../dexData');

exports.index = function(req, res) {
    getReadings(function(readings) {
        res.json({glucose: readings, trend: dexData.trend, lastEntry: new Date(dexData.lastEntry), next: dexData.next});
    });
};

function getReadings(cb) {
    Reading.find({time: {$gte: Date.now() - (3 * 60 * 60 * 1000)}}).sort({time: 1}).exec(function(err, readings) {
        var r = [];
        for (var x=0; x < readings.length; x++) {
            r.push(readings[x]._doc);
        }
        cb(r);
    });
}