app.constant('AUTH_EVENTS', {
  loginSuccess: 'auth-login-success',
  loginFailed: 'auth-login-failed',
  logoutSuccess: 'auth-logout-success',
  sessionTimeout: 'auth-session-timeout',
  notAuthenticated: 'auth-not-authenticated',
  notAuthorized: 'auth-not-authorized'
});

app.factory('AuthInterceptor', function($rootScope, $q, AUTH_EVENTS) {
  var statusDict = {
    401: AUTH_EVENTS.notAuthenticated,
    403: AUTH_EVENTS.notAuthorized,
    419: AUTH_EVENTS.sessionTimeout,
    440: AUTH_EVENTS.sessionTimeout
  };
  return {
    responseError: function(response) {
      $rootScope.$broadcast(statusDict[response.status], response);
      return $q.reject(response)
    }
  };
});

app.config(function($httpProvider) {
  $httpProvider.interceptors.push([
    '$injector',
    function($injector) {
      return $injector.get('AuthInterceptor');
    }
    ]);
});

app.service('AuthService', function($http, Session, $rootScope, AUTH_EVENTS, $q, $ionicPlatform, $cordovaNativeStorage, $cordovaPinDialog) {

  var outstandingRequest;

  function ensurePassword(user) {
    return new Promise(function(resolve, reject) {
      if (window.cordova && !user.loginPin) {
        $cordovaPinDialog.prompt("Enter a pin", "Enter Pin").then(function(results) {
          if (results.buttonIndex == 1) {
            if (results.input1.length < 4) {
              alert("Needs at least 4 digits");
              ensurePassword(user).then(resolve, reject);
            } else {
              $http.put('/api/users/update', {
                loginPin: results.input1
              })
              .then(function(res) {
                resolve(res.data);
              }).then(null, console.error);
            }
          }
          if (results.buttonIndex == 2) {
            ensurePassword(user).then(resolve, reject);
          }
        }).then(null, console.error);
      } else {
        resolve(user);
      }
    })
  }

  function onSuccessfulLogin(response) {
    return ensurePassword(response.data.user)
    .then(function(user) {
      Session.create(response.data.id, user);
      $rootScope.user = user;
      if (!user.locations || !user.locations.length) {
        $http.post('/api/users/location', location)
      }
      $ionicPlatform.ready(function() {
        if ($rootScope.user) {
          $cordovaNativeStorage.setItem("uid", $rootScope.user._id);
          $rootScope.$broadcast('user loaded');
        }
      });
      $rootScope.$broadcast(AUTH_EVENTS.loginSuccess);
      outstandingRequest = undefined;
      return user;
    }).then(null, console.error);
  }

  // Uses the session factory to see if an
  // authenticated user is currently registered.
  this.isAuthenticated = function() {
    return !!Session.user;
  };

  this.refreshSession = function() {
    if (outstandingRequest) return outstandingRequest;
    return outstandingRequest = new Promise(function(resolve, reject) {
      $ionicPlatform.ready(function() {
        // $cordovaNativeStorage.setItem("uid", "").then(function() { //autologin
          $cordovaNativeStorage.getItem("uid").then(function(val) {
            return $http.get('/session?' + jQuery.param({
              uid: val
            }))
          }).then(null, function(e) {
            if (e.status != 401) return $http.get('/session');
            else throw (e);
          })
          .then(onSuccessfulLogin).then(resolve).catch(function(e) {
            resolve(null);
            outstandingRequest = undefined;
          });
        // }) //remove
      })
    })
  }

  this.getLoggedInUser = function(fromServer) {

    // If an authenticated session exists, we
    // return the user attached to that session
    // with a promise. This ensures that we can
    // always interface with this method asynchronously.

    // Optionally, if true is given as the fromServer parameter,
    // then this cached value will not be used.

    if (this.isAuthenticated() && fromServer !== true) {
      return $q.when(Session.user);
    }

    // Make request GET /session.
    // If it returns a user, call onSuccessfulLogin with the response.
    // If it returns a 401 response, we catch it and instead resolve to null.
    return this.refreshSession();

  };

  this.login = function(credentials) {
    return $http.post('/login', credentials)
    .then(onSuccessfulLogin)
    .catch(function() {
      return $q.reject({
        message: 'Invalid login credentials.'
      });
    });
  };

  this.logout = function() {
    return $http.get('/logout').then(function() {
      Session.destroy();
      $cordovaNativeStorage.remove("uid");
      $rootScope.user = undefined;
      $rootScope.$broadcast(AUTH_EVENTS.logoutSuccess);
    });
  };

})

app.service('Session', function($rootScope, AUTH_EVENTS) {

  var self = this;

  $rootScope.$on(AUTH_EVENTS.notAuthenticated, function() {
    self.destroy();
  });

  $rootScope.$on(AUTH_EVENTS.sessionTimeout, function() {
    self.destroy();
  });

  this.id = null;
  this.user = null;

  this.create = function(sessionId, user) {
    this.id = sessionId;
    this.user = user;
  };

  this.destroy = function() {
    this.id = null;
    this.user = null;
  };

});

app.service('KeyService', function($http) {
  var self = this;
  this.keys = undefined;
  this.getKeys = function() {
    return new Promise(function(resolve, reject) {
      if (self.keys) resolve(self.keys);
      else {
        return $http.get('/api/publicKeys')
        .then(function(res) {
          self.keys = res.data;
          resolve(self.keys);
        }).then(null, console.log);
      }
    })
  }
});