require('dotenv').load();

exports.check = function(cb) {
    var pass = true;
    if (process.env.DEXCOM_USERNAME == undefined) {
        pass = false;
        console.log('Make sure your env.json has a defined DEXCOM_USERNAME');
    }
    if (process.env.DEXCOM_PASSWORD == undefined) {
        pass = false;
        console.log('Make sure your env.json has a defined DEXCOM_PASSWORD');
    }
    if (process.env.MONGO_URI == undefined) {
        pass = false;
        console.log('Make sure your env.json has a defined MONGO_PASSWORD');
    }
    return cb(pass);
};