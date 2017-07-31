'use strict';
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var passport = require('passport');
var path = require('path');
var mongoose = require('mongoose');
var UserModel = mongoose.model('User');
var FB = require('fb');

var plaid = require('plaid');

var client = new plaid.Client(
  global.env.PLAID.clientID,
  global.env.PLAID.secret,
  global.env.PLAID.publicKey,
  plaid.environments[global.env.PLAID.environment]
  );


var ENABLED_AUTH_STRATEGIES = [
'local',
  //'twitter',
  'facebook',
  //'google'
  ];

  module.exports = function(app) {

  // First, our session middleware will set/read sessions from the request.
  // Our sessions will get stored in Mongo using the same connection from
  // mongoose. Check out the sessions collection in your MongoCLI.
  app.use(session({
    secret: app.getValue('env').SESSION_SECRET,
    store: new MongoStore({
      mongooseConnection: mongoose.connection
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: false,
      expires: new Date(253402300000000)
    }
  }));

  // Initialize passport and also allow it to read
  // the request session information.
  app.use(passport.initialize());
  app.use(passport.session());

  // When we give a cookie to the browser, it is just the userId (encrypted with our secret).
  passport.serializeUser(function(user, done) {
    done(null, user.id);
  });

  // When we receive a cookie from the browser, we use that id to set our req.user
  // to a user found in the database.
  passport.deserializeUser(function(id, done) {
    UserModel.findById(id, done);
  });

  // We provide a simple GET /session in order to get session information directly.
  // This is used by the browser application (Angular) to determine if a user is
  // logged in already.
  app.get('/session', function(req, res, next) {
    if (req.user) {
      refreshUserData(req.user).then(function(user) {
        res.send({
          user: user.sanitize()
        });
        req.user.lastOpen = new Date();
        req.user.save();
      }).then(null, console.log);
    } else if (req.query.uid) {
      UserModel.findById(req.query.uid)
      .then(function(user) {
        if (user) {
          refreshUserData(user).then(function(user) {
            req.logIn(user, function(loginErr) {
              if (loginErr) return next(loginErr);
                // We respond with a response object that has user with _id and email.
                res.send({
                  user: user.sanitize()
                })
                user.lastOpen = new Date();
                user.save();
              });
          }).then(null, console.log);
        } else {
          res.status(401).send('No authenticated user.');
        }
      })
    } else {
      res.status(401).send('No authenticated user.');
    }
  });

  function refreshUserData(user) {
    var promArray = [];
    if (user.bank && user.bank.accessToken) {
      promArray.push(new Promise(function(resolve, reject) {
        client.getAuth(user.bank.accessToken, function(err, acctRes) {
          if (err) reject(err);
          else {
            user.bank.accounts = acctRes.accounts;
            user.bank.balance = acctRes.accounts.reduce(function(total, acct) {
              if (acct.subtype != 'credit card') return total + new Number(acct.balances.available);
              else return total;
            }, 0);
            user.save();
            resolve('ok');
          }
        });
      }))
    }
    if (user.facebook && user.facebook.accessToken) {
      promArray.push(new Promise(function(resolve, reject) {
        FB.api('/me', 'get', {
          access_token: user.facebook.accessToken,
          fields: 'id,name,gender,email,age_range,picture.type(large),friends'
        }, function(res) {
          var prof = {
            id: res.id,
            gender: res.gender,
            ageRange: res.age_range,
            email: res.email,
            name: res.name,
            accessToken: user.facebook.accessToken,
            profilePicture: res.picture.data.url,
            friends: res.friends.data,
            numFriends: res.friends.summary.total_count
          }
          user.facebook = prof;
          user.save();
          resolve('ok');
        })
      }));
    }
    return Promise.all(promArray)
    .then(function(users) {
      return user;
    });

  }

  // Simple /logout route.
  app.get('/logout', function(req, res) {
    req.logout();
    res.status(200).end();
  });

  // Each strategy enabled gets registered.
  ENABLED_AUTH_STRATEGIES.forEach(function(strategyName) {
    require(path.join(__dirname, strategyName))(app);
  });

};