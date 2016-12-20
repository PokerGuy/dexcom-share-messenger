var mongoose = require('mongoose');

// Define our user schema
var MessageSchema = new mongoose.Schema({
    dateTime: {
        type: Date,
        required: true
    },
    followersNotified: [{
        follower: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Follower'
        },
        action: {
            type: String
        }
    }],
    eventType: [{
        type: String
    }],
    acknowledged: {
        type: Boolean,
        default: false
    },
    acknowledgedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Follower'
    }
});


// Export the Mongoose model
module.exports = mongoose.model('Message', MessageSchema);