var mongoose = require('mongoose');
var User = mongoose.model('User');
var PrivateTransaction = mongoose.model('PrivateTransaction');
var router = require('express').Router();
var plaid = require('plaid');
var processTransactions = require('./../../helpers/transactionProcessor.js');
var moment = require('moment');


var plaidClient = new plaid.Client(
  global.env.PLAID.clientID,
  global.env.PLAID.secret,
  global.env.PLAID.publicKey,
  plaid.environments[global.env.PLAID.environment]
  );

module.exports = router;

router.post('/addBank', function(req, res, next) {
  return new Promise(function(resolve, reject) {
    plaidClient.exchangePublicToken(req.body.public_token, function(error, tokenResponse) {
      if (error) reject(error);
      else {
        var bank = {};
        bank.accessToken = tokenResponse.access_token;
        resolve(bank);
      }
    })
  })
  .then(function(bank) {
    return new Promise(function(resolve, reject) {
      plaidClient.getItem(bank.accessToken, function(err, itemRes) {
        if (err) reject(err);
        else {
          bank.item = itemRes.item;
          resolve(bank);
        }
      });
    })
  })
  .then(function(bank) {
    return new Promise(function(resolve, reject) {
      plaidClient.getInstitutionById(bank.item.institution_id, function(err, instRes) {
        if (err) reject(err);
        else {
          bank.item.institution = instRes.institution;
          resolve(bank);
        }
      });
    })
  })
  .then(function(bank) {
    return new Promise(function(resolve, reject) {
      plaidClient.getAuth(bank.accessToken, function(err, acctRes) {
        if (err) reject(err);
        else {
          bank.accounts = acctRes.accounts;
          bank.balance = acctRes.accounts.reduce(function(total, acct) {
            if (acct.subtype != 'credit card') return total + new Number(acct.balances.available);
            else return total;
          }, 0);
          bank.numbers = acctRes.numbers;
          new Promise(function(resolve1, reject1) {
            if (req.user) resolve1(req.user);
            else {
              User.findOne({
                "bank.numbers.wire_routing": bank.numbers[0].wire_routing,
                "bank.numbers.account": bank.numbers[0].account
              }).then(function(user) {
                if (user) {
                  resolve1(user)
                } else {
                  resolve1(new User());
                }
              }).then(null, reject1);
            }
          }).then(function(user) {
            if (!user.bank || !user.bank.accessToken) {
              if (!user.locations || !user.locations.length) user.locations = [req.body.lastLocation];
              user.bank = bank;
              fetchTransactions(user);
              console.log(global.env.ROOT_URL);
              plaidClient.updateItemWebhook(user.bank.accessToken, global.env.ROOT_URL + "/api/plaid/webhook", function(err, update) {
                console.log(err);
                console.log(update);
              })
            }
            resolve(user);
          }).then(null, reject);
        }
      });
    })
  }).then(function(user) {
    user.save();
    req.logIn(user, function(loginErr) {
      if (loginErr) reject(loginErr);
      else res.send('ok');
    });
  })
  .then(null, next);
});

router.get('/testFetch', function(req, res, next) {
  fetchTransactions(req.user);
  res.send('ok');
});

function fetchTransactions(user) {
  console.log('fetching transactions');
  PrivateTransaction.find({
    userID: user._id
  })
  .then(function(savedTransactions) {
    savedTransactions = savedTransactions.map(function(t) {
      return t.transaction_id;
    })
    var startDate = moment().subtract(90, 'days').format('YYYY-MM-DD');
    var endDate = moment().format('YYYY-MM-DD');
    plaidClient.getTransactions(user.bank.accessToken, startDate, endDate, {
      count: 100,
      offset: 0,
    }, function(error, transactionsResponse) {
      if (error) console.log(error);
      else {
        if (transactionsResponse.transactions.length == 0) {
          setTimeout(function() {
            fetchTransactions(user);
          }, 5000);
        } else {
          var tsToProcess = transactionsResponse.transactions.filter(function(t) {
            return !savedTransactions.includes(t.transaction_id);
          })
          processTransactions(tsToProcess, user, true)
          .then(function(transactions) {}).then(null, console.log);
        }
      }
    })
  }).then(null, console.log);
}

router.put('/update', function(req, res, next) {
  User.findByIdAndUpdate(req.user._id, req.body, {
    new: true
  })
  .then(function(user) {
    res.send(user);
  }).then(null, next);
})

router.post('/unlinkBank', function(req, res, next) {
  req.user.bank = undefined;
  req.user.save();

  res.send('ok');
})

router.post('/location', function(req, res, next) {
  if (!req.user) next(new Error('no user'));
  else {
    req.user.locations.push(req.body);
    req.user.save();
    res.send(req.user);
  }
})