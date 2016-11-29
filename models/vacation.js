var mongoose = require('mongoose');
var moment = require('moment-timezone');
var secureupdate = require('../controllers/secureupdate');

// Define our user schema
var VacationSchema = new mongoose.Schema({
    startDate: {
        type: Date,
        required: true,
        validate: {
            validator: function(v) {
                return (new Date() <= new Date(v))
            },
            message: 'The start date must be in the future'
        },
    },
    endDate: {
        type: Date,
        required: [true, 'End date must be provided'],
        validate: {
            validator: function(v) {
                return (new Date(v) >= new Date(this.startDate) );
            },
            message: 'The end date must come after the start date'
        }
    },
    name: {
        type: String,
        required: [true, 'Vacation name is required']
    }
});

VacationSchema.pre('validate', function(next) {
    var start = this._doc.startDate;
    start = new Date(start);
    start.setHours(0);
    start.setMinutes(0);
    start.setSeconds(0);
    start = new Date(moment.tz(start, process.env.TZ).format()).getTime();
    this._doc.startDate = new Date(start);
    var end = this._doc.endDate;
    end = new Date(end);
    end.setHours(23);
    end.setMinutes(59);
    end.setSeconds(59);
    end = new Date(moment.tz(end, process.env.TZ).format()).getTime();
    this._doc.endDate = new Date(end);
    next();
});

VacationSchema.pre('save', function(next) {
    var vacation = this._doc;
    mongoose.model('Vacation', VacationSchema).findOne({startDate: {$lte: vacation.startDate}, endDate: {$gte: vacation.startDate}}, function(err, vacay) {
        if (vacay) {
            var err = new Error('The start and end dates must not overlap with an existing holiday');
            next(err);
        } else {
            mongoose.model('Vacation', VacationSchema).findOne({startDate: {$lte: vacation.endDate}, endDate: {$gte: vacation.endDate}}, function(err, vacay) {
                if (vacay) {
                    var err = new Error('The start and end dates must not overlap with an existing holiday');
                    next(err);
                } else {
                    mongoose.model('Vacation', VacationSchema).findOne({startDate: {$gte: vacation.startDate}, endDate: {$lte: vacation.endDate}}, function (err, vacay) {
                        if (vacay) {
                            var err = new Error('The start and end dates must not overlap with an existing holiday');
                            next(err);
                        } else {
                            next();
                        }
                    });
                }
            });
        }
    });
});

VacationSchema.post('save', function(doc) {
    secureupdate.doUpdate('newvacation', doc);
});

VacationSchema.post('remove', function(doc) {
    secureupdate.doUpdate('deletevacation', {id: doc._id});
});
// Export the Mongoose model
module.exports = mongoose.model('Vacation', VacationSchema);