require('dotenv').load();
var twilio = require('twilio');

exports.receive = function (req, res) {
       console.log(req.body);
    res.json({message: "O'tay!"});
};
