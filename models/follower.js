var mongoose = require('mongoose');
var moment = require('moment-timezone');
var minlength = [2, 'The value of path `{PATH}` (`{VALUE}`) is shorter than the minimum allowed length ({MINLENGTH}).'];
var _ = require('lodash');

var eventSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['low', 'high', 'double up', 'double down', 'no data']
    },
    glucose: {
        type: Number,
        min: 40,
        max: 400
    },
    action: {
        type: String,
        required: true,
        enum: ['call', 'text', 'call/text']
    },
    repeat: {
        type: Number,
        required: true,
        min: 300000
    }
});

var timeBandSchema = new mongoose.Schema({
    startHour: {
        type: Number,
        required: true,
        min: 0,
        max: 23
    },
    startMinute: {
        type: Number,
        min: 0,
        max: 59,
        default: 0
    },
    endHour: {
        type: Number,
        required: true,
        min: 0,
        max: 23
    },
    endMinute: {
        type: Number,
        min: 0,
        max: 59,
        default: 0
    },
    event: [eventSchema]
});

var FollowerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        minlength: minlength
    },
    phoneNumber: {
        type: Number,
        min: 2000000000,
        max: 9999999999,
        unique: true,
        required: true
    },
    expirationDate: {
        type: Date,
        default: new Date('12/31/9999')
    },
    includeWeekendsAndHolidays: {
        type: Boolean,
        default: true
    },
    timeBand: [timeBandSchema]
});

FollowerSchema.pre('save', function (next) {
    var follower = this._doc;
    if (follower.timeBand.length === 0) {
        var err = new Error('At least one timeband is required');
        next(err);
    } else {
        for (var x = 0; x < follower.timeBand.length; x++) {
            if (follower.timeBand[x].event.length > 0) {
                if (follower.timeBand[x].startHour > follower.timeBand[x].endHour) {
                    var endHour = follower.timeBand[x].endHour;
                    var endMinute = follower.timeBand[x].endMinute;
                    var event = this.timeBand[x].event;
                    follower.timeBand[x].endHour = 23;
                    follower.timeBand[x].endMinute = 59;
                    follower.timeBand.push({
                        startHour: 0,
                        startMinute: 0,
                        endHour: endHour,
                        endMinute: endMinute,
                        event: event
                    });
                }
                var overLap = _.filter(follower.timeBand, function (band) {
                    if ((band.startHour > follower.timeBand[x].startHour && band.startHour < follower.timeBand[x].endHour) ||
                        (band.endHour > follower.timeBand[x].startHour && band.endHour < follower.timeBand[x].endHour)) {
                        return band;
                    }
                });
                if (overLap.length > 0) {
                    var err = new Error('Timebands cannot overlap');
                    next(err);
                }
                for (var y = 0; y < follower.timeBand[x].event.length; y++) {
                    var count = _.filter(follower.timeBand[x].event, function (e) {
                        return e.type === follower.timeBand[x].event[y].type;
                    });
                    if (count.length > 1) {
                        var err = new Error('All event types must be different within a time band');
                        next(err);
                    }
                }
            } else {
                var err = new Error('At least one event is required in a timeband');
                next(err);
            }
        }
        var expDate = new Date(follower.expirationDate);
        expDate.setHours(23);
        expDate.setMinutes(59);
        expDate.setSeconds(59);
        follower.expirationDate = new Date(moment.tz(expDate, process.env.TZ).format()).getTime();
        if (expDate.getTime() < new Date().getTime()) {
            var err = new Error('The expiration date must be in the future');
            next(err);
        }
        next();
    }
});

// Export the Mongoose model
module.exports = mongoose.model('Follower', FollowerSchema);