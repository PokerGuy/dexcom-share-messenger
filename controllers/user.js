require('dotenv').load();
var Token = require('../models/token');

exports.login = function(req, res) {
    if (req.body.password === process.env.DEXCOM_PASSWORD) {
        Token.issueToken(function (t) {
            res.json(t);
        });
    } else {
        res.statusCode = 401;
        res.send({'errors': ['Invalid password.']});
    }
};

exports.logout = function(req, res) {
    Token.findOneAndRemove({'token': req.params.token}, function (err) {
        if (!err) {
            res.json({message: 'logged out'});
        } else {
            res.json({message: err});
        }
    });
};