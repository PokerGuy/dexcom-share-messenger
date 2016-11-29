var mongoose = require('mongoose');
var uuid = require('node-uuid');

// Define our user schema
var TokenSchema = new mongoose.Schema({
    token: {
        type: String,
        unique: true,
        required: true
    },
    lastUsed: {
        type: Date,
        required: true
    }
});

TokenSchema.statics.findToken = function (token, cb) {
    this.findOne({'token': token}, function (err, token) {
            if (err) {
                return cb(err, null, null);
            } else {
                if (!token) {
                    return cb(null, null, {message: 'Invalid token.'});
                }
                if ((Date.now() - token.lastUsed) / 1000 > (24 * 60 * 60)) { //24 hours, 60 minutes per hour, 60 seconds per minute
                    return cb(null, null, {message: 'Session timed out.'});
                } else {
                    token.lastUsed = Date.now();
                    token.save();
                    return cb(null, token);
                }
            }
        }
    );
};

TokenSchema.statics.issueToken = function (cb) {
    var t = new this();
    t.token = uuid.v4();
    t.lastUsed = Date.now();
    t.save();
    cb(t);
};

// Export the Mongoose model
module.exports = mongoose.model('Token', TokenSchema);