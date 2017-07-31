'use strict';
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
var mongoose = require('mongoose');
var User = mongoose.model('User');
var FB = require('fb');

module.exports = function(app) {

  var facebookConfig = app.getValue('env').FACEBOOK;

  var facebookCredentials = {
    clientID: facebookConfig.appID,
    clientSecret: facebookConfig.secret,
    callbackURL: facebookConfig.callbackURL,
    passReqToCallback: true
  };

  var verifyCallback = function(req, accessToken, refreshToken, profile, done) {
    User.findOne({
      'facebook.id': profile.id
    }).exec()
    .then(function(user) {
      if (user) {
        return user;
      } else {
        return new Promise(function(resolve, reject) {
          FB.api('/me', 'get', {
            access_token: accessToken,
            fields: 'id,name,gender,email,age_range,picture.type(large),friends'
          }, function(res) {
            var prof = {
              id: res.id,
              gender: res.gender,
              ageRange: res.age_range,
              email: res.email,
              name: res.name,
              accessToken: accessToken,
              profilePicture: res.picture.data.url,
              friends: res.friends.data,
              numFriends: res.friends.summary.total_count
            }
            if (req.user) {
              req.user.facebook = prof;
              req.user.save();
              resolve(req.user);
            } else {
              var user = new User({
                facebook: prof
              })
              user.save();
              resolve(user);
            }
          })
        })
      }
    }).then(function(userToLogin) {
      console.log(userToLogin);
      done(null, userToLogin);
    })
    .catch(function(err) {
      console.error('Error creating user from Facebook authentication', err);
      done(err);
    })
  }

  passport.use(new FacebookStrategy(facebookCredentials, verifyCallback));

  app.get('/auth/facebook', passport.authenticate('facebook', {
    scope: ['user_friends']
  }));

  app.get('/auth/facebook/callback',
    passport.authenticate('facebook', {
      failureRedirect: '/#/menu/tab/public'
    }),
    function(req, res) {
      res.redirect('/#/menu/tab/public');
    });

};