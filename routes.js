var express = require('express');
var readings = require('./controllers/readings');
var updates  = require('./controllers/update');
var github = require('./controllers/github');
var user = require('./controllers/user');
var secure = require('./controllers/secure');
var auth = require('./auth');
var router = express.Router();

router.get('/', readings.index);
router.get('/update', updates.update);
router.post('/github', github.update);
router.post('/login', user.login);
router.delete('/logout/:token', auth.isAuthenticated, user.logout);
router.get('/secure', auth.isAuthenticated, secure.index);

module.exports = router;