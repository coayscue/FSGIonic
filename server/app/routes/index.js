'use strict';
var router = require('express').Router();
module.exports = router;

// router.use('/members', require('./members'));
router.use('/publicKeys', require('./pubKeys.js'));
router.use('/users', require('./CRUD/user.js'));
router.use('/transactions', require('./CRUD/transactions.js'));
router.use('/plaid', require('./plaidWebhooks.js'));

// Make sure this is after all of
// the registered routes!
router.use(function(req, res) {
  res.status(404).end();
});
