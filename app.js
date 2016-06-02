if (process.argv.length !== 4) {
    console.log('Please start the server with node app.js [username] [password]');
    process.exit();
}

var username = process.argv[2];
var password = process.argv[3];

