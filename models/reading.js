var mongoose = require('mongoose');
var Schema = mongoose.schema;

var ReadingSchema = new mongoose.Schema({
    time: Date,
    glucose: Number
});

ReadingSchema.statics.addReading = function (time, glucose) {
    this.findOne({'time': time}, function (err, reading) {
            if (err) {
                console.log('Something bad happened');
            } else {
                if (!reading) {
                    newReading(time, glucose);
                } else {
                    console.log('We already got one!');
                }
            }
        }
    );
};

function newReading (time, glucose) {
    var Reading = mongoose.model('Reading', ReadingSchema);
    var r = new Reading({time: time, glucose: glucose});
    r.save();
    console.log('Added a new reading. Cool.');
};

// Export the Mongoose model
    module.exports = mongoose.model('Reading', ReadingSchema);