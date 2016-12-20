var clients = {};
var clientId = 0;
var lastEntry;
var Token = require('../models/token');

exports.setLastEntry = function(last) {
    lastEntry = last;
};

exports.update = function(req, res) {
    var t = req.params.token;
    Token.findToken(t, function(err, token){
        if (!token) {
            res.sendStatus(401);
        } else {
            req.socket.setTimeout(0);
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
                'Access-Control-Allow-Origin': '*'
            });
            res.write('\n');
            if (req.headers['last-event-id'] == new Date(lastEntry).getTime()) {
                res.write('\n'); //This is either a new request or the client lost contact with the server briefly but is still in synch
            } else {
                //The client is out of synch, tell it to refresh itself with an SSE
                res.write('event: synch\n');
                res.write('data: Need to do a sync\n\n');
            }
            (function (clientId) {
                clients[clientId] = res;
                req.on('close', function () {
                    delete clients[clientId]
                });
            })(++clientId)
        }
    });
};

exports.doUpdate = function(type, obj) {
    for (clientId in clients) {
        clients[clientId].write("id: " + new Date().getTime() + "\n");
        clients[clientId].write("event: " + type + "\n");
        clients[clientId].write("data: " + JSON.stringify(obj) + "\n\n");
    }
};
