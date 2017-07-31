var mongoose = require('mongoose');
var User = mongoose.model('User');
var Transaction = mongoose.model('Transaction');
var PrivateTransaction = mongoose.model('PrivateTransaction');
var router = require('express').Router();
var plaid = require('plaid');
var moment = require('moment');

var push = require('./../../helpers/pushNotifications.js');

var client = new plaid.Client(
  global.env.PLAID.clientID,
  global.env.PLAID.secret,
  global.env.PLAID.publicKey,
  plaid.environments[global.env.PLAID.environment]
  );

module.exports = router;

router.get('/recent', function(req, res, next) {
  if (!req.user || !req.user.bank.accessToken) res.send([]);
  else {
    PrivateTransaction.find({
      userID: req.user._id
    }).limit(100).sort({
      date: -1
    }).then(function(transactions) {
      res.send(transactions);
    }).then(null, next);
  }
})

router.post('/post', function(req, res, next) {
  if (!req.user) next(new Error('no user'));
  else {
    var trans = new Transaction(req.body);
    trans.userFBID = req.user.facebook.id;
    trans.save();
    req.user.coinBalance += trans.amount;
    req.user.save();

    PrivateTransaction.findByIdAndUpdate(req.body._id, {
      published: true
    })
    .then(function(trans) {})

    User.find({
      "facebook.id": {
        $in: getFriendIds(req.user)
      }
    }).then(function(friends) {
      var pushTokens = friends.map(function(f) {
        return f.pushToken;
      }).filter(function(val) {
        return !!val;
      })
      var title = req.user.facebook.name;
      var message = "Spent $" + trans.amount.toFixed(2) + " at " + trans.name;
      push(pushTokens, title, message);
    }).then(null, console.log);
    res.send(trans);
  }
})

router.post('/delete', function(req, res, next) {
  if (!req.user) next(new Error('no user'));
  else {
    Transaction.findOneAndRemove({
      transaction_id: req.body.transaction_id
    })
    .then(function(tran) {
      return PrivateTransaction.findOneAndUpdate({
        transaction_id: req.body.transaction_id
      }, {
        published: false
      })
    })
    .then(function(t) {
      res.send(tran);
    }).then(null, next);
  }
})

router.get('/public', function(req, res, next) {
  if (!req.user) next(new Error('no logged in user'));
  else {
    var ids = getFriendIds(req.user);
    ids.push(req.user.facebook.id);
    Transaction.find({
      userFBID: {
        $in: ids
      }
    }).populate('userID')
    .then(function(transactions) {
      console.log(transactions.length);
      Transaction.find({
        userFBID: {
          $nin: ids
        }
      }).populate('userID')
      .then(function(otherTrans) {
        console.log(otherTrans.length);
        res.send(transactions.concat(otherTrans));
      }).then(null, next);
    }).then(null, next);
  }
})

router.get('/forUser', function(req, res, next) {
  Transaction.find({
    userID: req.query.uid
  }).then(function(ts) {
    res.send(ts);
  }).then(null, next)
})

router.put('/update', function(req, res, next) {
  Transaction.findByIdAndUpdate(req.body._id, req.body, {
    new: true
  }).populate('userID')
  .then(function(trans) {
    if (req.body.purpose == 'comment' && trans.userID.pushToken) {
      var title = req.user.facebook.name;
      var message = 'Commented on your ' + trans.name + ' purchase, "' + req.body.newComment + '"';
      push([trans.userID.pushToken], title, message);
    } else if (req.body.purpose == 'like' && trans.userID.pushToken) {
      var title = req.user.facebook.name;
      var message = 'Liked your ' + trans.name + ' purchase';
      push([trans.userID.pushToken], title, message);
    }

    res.send(trans);
  }).then(null, next);
})

function getFriendIds(user) {
  return user.facebook.friends.map(function(f) {
    return f.id;
  })
}