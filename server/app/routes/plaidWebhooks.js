var router = require('express').Router();
var plaid = require('plaid');
var mongoose = require('mongoose')
var Transaction = mongoose.model('Transaction');
var PrivateTransaction = mongoose.model('PrivateTransaction');
var User = mongoose.model('User');
var moment = require('moment');
var queryString = require('query-string');
var googleMapsClient = require('@google/maps').createClient({
  key: global.env.GOOGLE.apiKey,
  Promise: Promise
});

var push = require('./../helpers/pushNotifications.js');
var processTransactions = require('./../helpers/transactionProcessor.js');

var plaidClient = new plaid.Client(
  global.env.PLAID.clientID,
  global.env.PLAID.secret,
  global.env.PLAID.publicKey,
  plaid.environments[global.env.PLAID.environment]
  );

module.exports = router;

router.post('/webhook', function(req, res, next) {
  if (req.body.webhook_type == "TRANSACTIONS") {
    if (req.body.webhook_code == "REMOVED_TRANSACTIONS") {
      removeTransactions(req.body.removed_transactions);
    } else {
      fillTransactions(req.body.item_id, req.body.new_transactions, req.body.webhook_code);
    }
  }
  res.send('ok');
})

router.post("/test", function(req, res, next) {
  fillTransactions(req.user.bank.item.item_id, 4, "DEFAULT_UPDATE");
  res.send('fine');
})

function fillTransactions(itemID, count, type) {
  User.findOne({
    'bank.item.item_id': itemID
  })
  .then(function(user) {
    if (user.pushToken) push([user.pushToken], "New Transactions", "You have " + count + " new transactions to review.");
    PrivateTransaction.find({
      userID: user._id
    })
    .then(function(savedTransactions) {
      savedTransactions = savedTransactions.map(function(t) {
        return t.transaction_id;
      })
      var startDate = moment().subtract(90, 'days').format('YYYY-MM-DD');
      var endDate = moment().format('YYYY-MM-DD');
      if (count > 500) count = 500;
      plaidClient.getTransactions(user.bank.accessToken, startDate, endDate, {
        count: count,
        offset: 0,
      }, function(error, transactionsResponse) {
        if (error) console.log(error);
        else {
          var tsToProcess = transactionsResponse.transactions.filter(function(t) {
            return !savedTransactions.includes(t.transaction_id);
          })
          processTransactions(tsToProcess, user, false)
          .then(function(transactions) {
            if (type == "DEFAULT_UPDATE") {
              var lastLocation = user.locations[user.locations.length - 1];
              user.locations = [lastLocation];
              user.save();
            }
          }).then(null, console.log);
        }
      })
    }).then(null, console.log)
  }).then(null, console.log);
}

function removeTransactions(ids) {
  PrivateTransaction.findAndRemove({
    transaction_id: {
      $in: ids
    }
  })
  .then(function(transactions) {}).then(null, console.log);
}