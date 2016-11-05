require('dotenv').load();
var sys = require('sys');
var exec = require('child_process').exec;
var crypto = require('crypto');

exports.update = function(req, res) {
    var
        hmac,
        calculatedSignature,
        payload = req.body;

    hmac = crypto.createHmac('sha1', process.env.DEXCOM_PASSWORD);
    hmac.update(JSON.stringify(payload));
    calculatedSignature = 'sha1=' + hmac.digest('hex');

    if (req.headers['x-hub-signature'] === calculatedSignature) {
        console.log('all good starting pull for ' + payload.repository.name);
        res.status(200);
        if (payload.repository.name == 'dexcom-share-client') {
            function puts(error, stdout, stderr) {
                sys.puts(stdout)
            }

            exec("echo " + process.env.DEXCOM_PASSWORD + " | sudo -S /home/evan/dexcom-share-messenger/upgradeclient.sh", puts);
        } else if (payload.repository.name == 'dexcom-share-messenger') {
            function puts(error, stdout, stderr) {
                sys.puts(stdout)
            }

            exec("echo " + process.env.DEXCOM_PASSWORD + " | sudo -S /home/evan/dexcom-share-messenger/upgradeserver.sh", puts);
        }
    } else {
        console.log('not good');
        res.status(401).send({message: "unauthorized"});
    }
};