var async = require('async');

async.series([
    function(done) {
        setTimeout(function() {
            console.log('first thing');
            done();
        }, 2000);
    },
    function(done) {
        setTimeout(function() {
            console.log('second thing');
            done();
        }, 500);
    },
    function(done) {
        setTimeout(function() {
            console.log('third thing');
            done();
        }, 1000);
    }
]);