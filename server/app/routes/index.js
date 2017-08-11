'use strict';
var router = require('express').Router();
module.exports = router;

router.use('/authmodule', require('./CRUD/authModule.js'));
router.use('/publicKeys', require('./pubKeys.js'));
router.use('/users', require('./CRUD/user.js'));
router.use('/session', require('./CRUD/session.js'));

// Make sure this is after all of
// the registered routes!
router.use(function(req, res) {
  res.status(404).end();
});