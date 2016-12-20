var express = require('express');
var readings = require('./controllers/readings');
var updates  = require('./controllers/update');
var secureupdate  = require('./controllers/secureupdate');
var github = require('./controllers/github');
var user = require('./controllers/user');
var secure = require('./controllers/secure');
var vacation = require('./controllers/vacation');
var follower = require('./controllers/follower');
var auth = require('./auth');
var twiml = require('./controllers/twiml');
var router = express.Router();

router.get('/', readings.index);
router.get('/update', updates.update);
router.get('/secureupdate/:token', secureupdate.update);
router.post('/github', github.update);
router.post('/login', user.login);
router.delete('/logout/:token', auth.isAuthenticated, user.logout);
router.get('/secure', auth.isAuthenticated, secure.index);
router.get('/vacation', auth.isAuthenticated, vacation.index);
router.post('/vacation', auth.isAuthenticated, vacation.create);
router.delete('/vacation/:id', auth.isAuthenticated, vacation.delete);
router.post('/follower', auth.isAuthenticated, follower.create);
router.delete('/follower/:id', auth.isAuthenticated, follower.delete);
router.post('/follower/:id/timeband', auth.isAuthenticated, follower.addTimeBand);
router.post('/follower/:followerId/timeband/:timebandId/event', auth.isAuthenticated, follower.addEvent);
router.delete('/follower/:followerId/timeband/:timebandId', auth.isAuthenticated, follower.deleteTimeBand);
router.delete('/follower/:followerId/timeband/:timebandId/event/:eventId', auth.isAuthenticated, follower.deleteEvent);
router.get('/follower', auth.isAuthenticated, follower.index);
router.post('/twiml', twiml.sendPhoneCall);
module.exports = router;