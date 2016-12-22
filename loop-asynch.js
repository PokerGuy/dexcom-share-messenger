var async = require('async');

async.series[
    function (done) {
        for (var i = 1; i <= 10; i++) {
            setTimeout(function () {
                console.log(i);
            }, 1000);
        }
        done();
    },
        function (done) {
            console.log('done looping');
            done();
        }
    ];