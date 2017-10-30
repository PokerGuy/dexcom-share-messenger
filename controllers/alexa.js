var dexData = require('../dexData');

exports.index = function (req, res) {
    var response = {glucose: dexData.glucose, trend: dexData.trend, last: dexData.lastEntry};
    res.json(response);
};
