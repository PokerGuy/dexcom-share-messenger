var moment = require('moment-timezone');
var _ = require('lodash')
var sorted = _.sortBy(moment.tz.names(), function (name) {
    return name;
});

var found = [];

var f = _.filter(sorted, function(tz) {
    var first = tz.split('/')[0];
    if (found.indexOf(first) == -1) {
        found.push(first);
        return first;
    }
});
console.log(found);
