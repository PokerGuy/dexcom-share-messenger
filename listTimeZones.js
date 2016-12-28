var moment = require('moment-timezone');
var _ = require('lodash')

var f = _.each(moment.tz.names(), function(tz) {
        console.log(tz);
});
