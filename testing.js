var async = require('async');

async.series([
    function(done) {
        async.each([1,2,3,4,5,6,7,8,9,10], function(item, callback) {
            setTimeout(function () {
                console.log(item);
                callback();
            }, 3000)
        }, function(err) {
            done();
        })
    },
    function(done) {
        setTimeout(function() {
            console.log('second thing');
            done();
        }, 3000);
    },
    function(done) {
        setTimeout(function() {
            console.log('third thing');
            done();
        }, 1000);
    }
]);
