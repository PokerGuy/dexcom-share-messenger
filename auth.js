var passport = require('passport');
var BearerStrategy = require('passport-http-bearer');
var Token = require('./models/token');

passport.use(new BearerStrategy(
    function (token, cb) {
        Token.findToken(token, function (err, token, info) {
            if (err) {
                return cb(err);
            }
            if (!token) {
                return cb(null, null, info)
            } else {
                return cb(null, token, {scope: 'all'});
            }
        });
    }));

exports.isAuthenticated = passport.authenticate('bearer', {session: false});