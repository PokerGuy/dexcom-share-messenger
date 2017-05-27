require('dotenv').load();
var twilio = require('twilio');
var dexData = require('../dexData');

exports.sendPhoneCall = function(req, res) {
        var twiml = new twilio.TwimlResponse();
        twiml.gather({
            numDigits: 1,
            action: process.env.RESPONSE_URL
        }, function(gatherNode) {
            gatherNode.say('Please check on ' + process.env.CHILD_NAME + '. Currently at ' + dexData.glucose + ' glucose event is ' + dexData.eventType + '. Press any key to send an acknowledgement of this alert.', {
                voice:'woman',
                language:'en-gb'
            });
        });
        res.type('text/xml');
        res.send(twiml.toString());
};
