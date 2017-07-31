'use strict';

// Ionic Starter App
// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.services' is found in services.js
// 'starter.controllers' is found in controllers.js

// var rootUrl = "http://localhost:8000"; //browser/simulator development
var rootUrl = "https://minkchat.com"; //production
window.app = angular.module('starter', ['ionic', 'ionic.cloud', 'ngCordova', 'ngCordova.plugins.nativeStorage', 'ngCordova.plugins.pinDialog']).controller('AppController', function ($rootScope) {}).run(function ($cordovaNativeStorage) {
  window.storage = $cordovaNativeStorage;
}).config(function ($ionicCloudProvider) {
  $ionicCloudProvider.init({
    "core": {
      "app_id": "ef8ae420"
    },
    "push": {
      "sender_id": "123890098321",
      "pluginConfig": {
        "ios": {
          "badge": true,
          "sound": true
        },
        "android": {
          "iconColor": "#343434"
        }
      }
    }
  });
}).config(function ($urlRouterProvider, $httpProvider) {
  //comment out for dev
  $httpProvider.interceptors.push(function () {
    return {
      request: function request(config) {
        config.url = rootUrl + (config.url.charAt(0) == '/' ? '' : '/') + config.url;
        return config;
      },
      response: function response(res) {
        return res;
      }
    };
  });

  $urlRouterProvider.otherwise('/menu/tab/public');
}).run(function ($ionicPlatform, $http, $rootScope, AuthService, KeyService, $cordovaNativeStorage, $cordovaPinDialog) {
  $ionicPlatform.ready(function () {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
      cordova.plugins.Keyboard.disableScroll(true);
    }
    if (window.StatusBar) {
      // org.apache.cordova.statusbar required
      StatusBar.styleDefault();
    }
    AuthService.getLoggedInUser().then(function (user) {
      $rootScope.user = user;
    });

    KeyService.getKeys();

    $ionicPlatform.on('resume', function () {
      $rootScope.$broadcast('resume');
      AuthService.refreshSession();
      $rootScope.$on('user loaded', function (event, data) {
        if ($rootScope.user && $rootScope.user.loginPin && window.cordova && $rootScope.blackout) enterPin();
      });
      if ($rootScope.user && $rootScope.user.loginPin && window.cordova && $rootScope.blackout) enterPin();
    });
    $ionicPlatform.on('pause', function (event, data) {
      if ($rootScope.user && $rootScope.user.loginPin) $rootScope.blackout = true;
      if (!$rootScope.$$phase) $rootScope.$apply();
    });
  });

  document.addEventListener('deviceready', function () {

    var bgGeo = window.BackgroundGeolocation;

    window.locCallback = function (location, taskID) {
      console.error('[js] BackgroundGeolocation callback:  ' + location.coords.latitude + ',' + location.coords.longitude);
      if (location.coords.longitude) {
        $http.post('/api/users/location', location.coords).then(function (res) {
          bgGeo.finish(taskID);
        }).then(null, function (err) {
          console.error(err);
          $rootScope.lastLocation = location.coords;
          bgGeo.finish(taskID);
        });
      } else {
        bgGeo.finish(taskID);
      }
    };

    window.locFailure = function (error) {
      console.error('BackgroundGeolocation error');
      console.error(error);
    };

    bgGeo.configure({
      desiredAccuracy: 100,
      distanceFilter: 30,
      stationaryRadius: 200,
      stopOnTerminate: false,
      startOnBoot: true,
      useSignificantChangesOnly: true
    }, function (state) {
      if (!state.enabled) {
        bgGeo.start();
      }
    });

    bgGeo.on('location', window.locCallback, window.locFailure);
  }, true);

  var outstandingPin = false;

  function enterPin() {
    function checkPin() {
      $cordovaPinDialog.prompt("Enter your pin", "Enter Pin").then(function (results) {
        if (results.buttonIndex == 1 && results.input1 != $rootScope.user.loginPin) checkPin();else if (results.buttonIndex == 2) checkPin();else {
          outstandingPin = false;
          $rootScope.blackout = false;
        }
      }).then(null, console.error);
    }
    if (!outstandingPin) {
      outstandingPin = true;
      checkPin();
    }
  }
});

app.run(function ($rootScope) {
  $rootScope.checkRange = function (property, min, max) {
    if (property < min) return min;
    if (property > max) return max;
    return property;
  };

  $rootScope.err = function (err) {
    console.log(err);
    if (err.message) $.Zebra_Dialog(err.message);else if (err.data) $.Zebra_Dialog(err.data);else $.Zebra_Dialog(err.statusText);
  };
});

document.addEventListener("deviceready", onDeviceReady, false);

function onDeviceReady() {
  window.open = cordova.InAppBrowser.open;
}
app.constant('AUTH_EVENTS', {
  loginSuccess: 'auth-login-success',
  loginFailed: 'auth-login-failed',
  logoutSuccess: 'auth-logout-success',
  sessionTimeout: 'auth-session-timeout',
  notAuthenticated: 'auth-not-authenticated',
  notAuthorized: 'auth-not-authorized'
});

app.factory('AuthInterceptor', function ($rootScope, $q, AUTH_EVENTS) {
  var statusDict = {
    401: AUTH_EVENTS.notAuthenticated,
    403: AUTH_EVENTS.notAuthorized,
    419: AUTH_EVENTS.sessionTimeout,
    440: AUTH_EVENTS.sessionTimeout
  };
  return {
    responseError: function responseError(response) {
      $rootScope.$broadcast(statusDict[response.status], response);
      return $q.reject(response);
    }
  };
});

app.config(function ($httpProvider) {
  $httpProvider.interceptors.push(['$injector', function ($injector) {
    return $injector.get('AuthInterceptor');
  }]);
});

app.service('AuthService', function ($http, Session, $rootScope, AUTH_EVENTS, $q, $ionicPlatform, $cordovaNativeStorage, $cordovaPinDialog) {

  var outstandingRequest;

  function ensurePassword(user) {
    return new Promise(function (resolve, reject) {
      if (window.cordova && !user.loginPin) {
        $cordovaPinDialog.prompt("Enter a pin", "Enter Pin").then(function (results) {
          if (results.buttonIndex == 1) {
            if (results.input1.length < 4) {
              alert("Needs at least 4 digits");
              ensurePassword(user).then(resolve, reject);
            } else {
              $http.put('/api/users/update', {
                loginPin: results.input1
              }).then(function (res) {
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
    });
  }

  function onSuccessfulLogin(response) {
    return ensurePassword(response.data.user).then(function (user) {
      Session.create(response.data.id, user);
      $rootScope.user = user;
      if (!user.locations || !user.locations.length) {
        $http.post('/api/users/location', location);
      }
      $ionicPlatform.ready(function () {
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
  this.isAuthenticated = function () {
    return !!Session.user;
  };

  this.refreshSession = function () {
    if (outstandingRequest) return outstandingRequest;
    return outstandingRequest = new Promise(function (resolve, reject) {
      $ionicPlatform.ready(function () {
        // $cordovaNativeStorage.setItem("uid", "").then(function() { //autologin
        $cordovaNativeStorage.getItem("uid").then(function (val) {
          return $http.get('/session?' + jQuery.param({
            uid: val
          }));
        }).then(null, function (e) {
          if (e.status != 401) return $http.get('/session');else throw e;
        }).then(onSuccessfulLogin).then(resolve).catch(function (e) {
          resolve(null);
          outstandingRequest = undefined;
        });
        // }) //remove
      });
    });
  };

  this.getLoggedInUser = function (fromServer) {

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

  this.login = function (credentials) {
    return $http.post('/login', credentials).then(onSuccessfulLogin).catch(function () {
      return $q.reject({
        message: 'Invalid login credentials.'
      });
    });
  };

  this.logout = function () {
    return $http.get('/logout').then(function () {
      Session.destroy();
      $cordovaNativeStorage.remove("uid");
      $rootScope.user = undefined;
      $rootScope.$broadcast(AUTH_EVENTS.logoutSuccess);
    });
  };
});

app.service('Session', function ($rootScope, AUTH_EVENTS) {

  var self = this;

  $rootScope.$on(AUTH_EVENTS.notAuthenticated, function () {
    self.destroy();
  });

  $rootScope.$on(AUTH_EVENTS.sessionTimeout, function () {
    self.destroy();
  });

  this.id = null;
  this.user = null;

  this.create = function (sessionId, user) {
    this.id = sessionId;
    this.user = user;
  };

  this.destroy = function () {
    this.id = null;
    this.user = null;
  };
});

app.service('KeyService', function ($http) {
  var self = this;
  this.keys = undefined;
  this.getKeys = function () {
    return new Promise(function (resolve, reject) {
      if (self.keys) resolve(self.keys);else {
        return $http.get('/api/publicKeys').then(function (res) {
          self.keys = res.data;
          resolve(self.keys);
        }).then(null, console.log);
      }
    });
  };
});
//map stuff
function openMap(trans, $scope, $ionicModal, $http, type) {
  $scope.selectedTrans = trans;

  $ionicModal.fromTemplateUrl('/modals/map.html', {
    scope: $scope,
    animation: 'slide-in-up'
  }).then(function (modal) {
    $scope.mapModal = modal;
    $scope.openMap();
  });

  $scope.closeMap = function () {
    $scope.map.remove();
    var popup = document.getElementById('map-poppup');
    popup.parentNode.removeChild(popup);
    $scope.mapModal.hide();
  };

  // Cleanup the modal when we're done with it!
  $scope.$on('$destroy', function () {
    $scope.modal.remove();
  });

  //open
  $scope.openMap = function () {
    $scope.mapModal.show();
    new Promise(function (resolve, reject) {
      if (type == "public") {
        $http.get("/api/transactions/forUser?" + jQuery.param({
          uid: trans.userID._id
        })).then(function (res) {
          resolve(res.data);
        }).then(null, reject);
      } else {
        resolve($scope.transactions);
      }
    }).then(function (data) {
      L.mapbox.accessToken = 'pk.eyJ1IjoiY29heXNjdWUiLCJhIjoiY2o0eXAzNWF6MXZ3bjMzbmtpdmdwdzFibSJ9.hFSrzFaz9h-Jupv4yHh7_Q';
      $scope.map = L.mapbox.map('map-poppup', 'mapbox.streets').setView([trans.location.lat, trans.location.lon], 15);
      var markers = new L.MarkerClusterGroup();
      var data = data.forEach(function (t) {
        if (t.location.lat) {
          var title = generateTitle(t);
          var marker = L.marker(new L.LatLng(t.location.lat, t.location.lon), {
            icon: L.mapbox.marker.icon({}),
            title: title
          });
          marker.bindPopup(title);
          markers.addLayer(marker);
        }
      });
      $scope.map.addLayer(markers);

      var title = generateTitle(trans);
      L.popup().setLatLng([trans.location.lat + .0003, trans.location.lon]).setContent(title).openOn($scope.map);
    }).then(null, console.error);
  };

  function generateTitle(tran) {
    return "<div style='text-align:center'><h3>" + tran.name + "</h3>" + (tran.caption ? "<h4>" + tran.caption + "</h4>" : "") + "<h4>$" + tran.amount.toFixed(2) + "</h4><div style='height:100px; width:100%; min-width:200px; overflow:scroll; overflow-y:hidden; -webkit-overflow-scrolling: touch;'><div style='text-align:left; background-color:gray; height:100px; width:10000px;'>" + tran.photos.reduce(function (sum, p) {
      return sum + "<img style='height:100%' src='" + p + "'/>";
    }, "") + "</div></div></</div>";
  }
}
angular.module('starter.services', []).factory('Chats', function () {
  // Might use a resource here that returns a JSON array

  // Some fake testing data
  var chats = [{
    id: 0,
    name: 'Ben Sparrow',
    lastText: 'You on your way?',
    face: 'img/ben.png'
  }, {
    id: 1,
    name: 'Max Lynx',
    lastText: 'Hey, it\'s me',
    face: 'img/max.png'
  }, {
    id: 2,
    name: 'Adam Bradleyson',
    lastText: 'I should buy a boat',
    face: 'img/adam.jpg'
  }, {
    id: 3,
    name: 'Perry Governor',
    lastText: 'Look at my mukluks!',
    face: 'img/perry.png'
  }, {
    id: 4,
    name: 'Mike Harrington',
    lastText: 'This is wicked good ice cream.',
    face: 'img/mike.png'
  }];

  return {
    all: function all() {
      return chats;
    },
    remove: function remove(chat) {
      chats.splice(chats.indexOf(chat), 1);
    },
    get: function get(chatId) {
      for (var i = 0; i < chats.length; i++) {
        if (chats[i].id === parseInt(chatId)) {
          return chats[i];
        }
      }
      return null;
    }
  };
});

app.service('PtrService', ['$timeout', '$ionicScrollDelegate', function ($timeout, $ionicScrollDelegate) {

  /**
   * Trigger the pull-to-refresh on a specific scroll view delegate handle.
   * @param {string} delegateHandle - The `delegate-handle` assigned to the `ion-content` in the view.
   */
  this.triggerPtr = function (delegateHandle) {

    $timeout(function () {

      var scrollView = $ionicScrollDelegate.$getByHandle(delegateHandle).getScrollView();

      if (!scrollView) return;

      scrollView.__publish(scrollView.__scrollLeft, -scrollView.__refreshHeight, scrollView.__zoomLevel, true);

      var d = new Date();

      scrollView.refreshStartTime = d.getTime();

      scrollView.__refreshActive = true;
      scrollView.__refreshHidden = false;
      if (scrollView.__refreshShow) {
        scrollView.__refreshShow();
      }
      if (scrollView.__refreshActivate) {
        scrollView.__refreshActivate();
      }
      if (scrollView.__refreshStart) {
        scrollView.__refreshStart();
      }
    });
  };
}]);

app.config(function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('menu.tab.login', {
    url: '/login',
    views: {
      'tab-login': {
        templateUrl: 'js/states/login/login.html',
        controller: 'LoginCtrl'
      }
    }
  });
}).controller('LoginCtrl', function ($scope, $http, $rootScope, $state, KeyService) {
  // Load the SDK asynchronously

});

app.config(function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('menu.tab.public', {
    url: '/public',
    views: {
      'tab-public': {
        templateUrl: 'js/states/public/public.html',
        controller: 'PublicCtrl'
      }
    }
  });
}).controller('PublicCtrl', function ($scope, $http, $rootScope, $state, AuthService, PtrService, $window, $ionicPush, $ionicModal, $cordovaPinDialog, $ionicPlatform, $location) {

  (function (d, s, id) {
    var js,
        fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s);
    js.id = id;
    js.src = "https://connect.facebook.net/en_US/sdk.js";
    fjs.parentNode.insertBefore(js, fjs);
  })(document, 'script', 'facebook-jssdk');

  function registerPush() {
    $ionicPush.register().then(function (t) {
      console.error(t);
      $http.put('/api/users/update', {
        pushToken: t.token
      }).then(function (res) {
        AuthService.refreshSession();
      }).then(null, console.error);
    }).then(null, console.error);
  }

  $scope.$on('user loaded', function (event, data) {
    if ($rootScope.user && $rootScope.user.facebook.id && !$rootScope.user.pushToken) registerPush();
  });
  if ($rootScope.user && $rootScope.user.facebook.id && !$rootScope.user.pushToken) registerPush();

  $scope.getTransactions = function () {
    $http.get('/api/transactions/public').then(function (res) {
      $scope.transactions = res.data.sort(function (a, b) {
        return b.date - a.date;
      });
      $scope.$broadcast('scroll.refreshComplete');
    }).then(null, $rootScope.err);
  };

  $rootScope.$on('getTransactions', function () {
    console.error('hello');
    $scope.getTransactions();
  });

  $scope.fbLogin = function () {
    var loginWindow = $window.open(encodeURI(rootUrl + "/auth/facebook"), '_blank', 'location=no,toolbar=no');
    loginWindow.addEventListener('loadstart', function (e) {
      if (e.url.includes("menu/tab/public")) {
        loginWindow.close();
        $window.location.reload();
        // AuthService.refreshSession();
      }
    });
    console.error(loginWindow);
  };

  $scope.$on("$ionicView.loaded", function () {
    AuthService.getLoggedInUser().then(function (user) {
      if (user && user.facebook.id) {
        PtrService.triggerPtr('p-refresher');
      }
    });
  });

  $scope.openMapCall = function (trans) {
    openMap(trans, $scope, $ionicModal, $http, "public");
  };

  $scope.createComment = function (trans) {
    var newComment = {
      name: $rootScope.user.facebook.name,
      text: trans.newComment
    };
    trans.comments.push(newComment);
    trans.purpose = "comment";
    $http.put('/api/transactions/update', trans).then(function (res) {}).then(null, console.error);
  };

  $scope.like = function (trans) {
    trans.likes.push($rootScope.user.facebook.id);
    trans.purpose = "like";
    $http.put('/api/transactions/update', trans).then(function (res) {}).then(null, console.error);
  };
});
app.config(function ($stateProvider) {
  $stateProvider.state('menu', {
    url: '/menu',
    abstract: true,
    templateUrl: 'js/states/menu/menu.html',
    controller: 'MenuCtrl'
  });
}).controller('MenuCtrl', function ($scope, $http, $rootScope, $state, KeyService, $ionicModal, Session, AuthService) {

  $ionicModal.fromTemplateUrl('/modals/unlinkModal.html', {
    scope: $scope,
    animation: 'slide-in-up'
  }).then(function (modal) {
    $scope.modal = modal;
  });

  $scope.logout = function () {
    AuthService.logout();
  };

  $scope.openModal = function () {
    $scope.modal.show();
  };
  $scope.closeModal = function () {
    $scope.modal.hide();
  };
  // Cleanup the modal when we're done with it!
  $scope.$on('$destroy', function () {
    $scope.modal.remove();
  });

  $scope.unlinkBank = function () {
    $http.post('/api/users/unlinkBank', {}).then(function (res) {
      console.log(res.data);
      AuthService.refreshSession().then(function (user) {
        $rootScope.user = user;
      });
      $scope.openModal();
    }).then(null, $rootScope.err);
  };
});
app.config(function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('menu.tab.personal', {
    url: '/personal',
    views: {
      'tab-personal': {
        templateUrl: 'js/states/personal/personal.html',
        controller: 'PersonalCtrl'
      }
    }
  });
}).controller('PersonalCtrl', function (KeyService, $scope, $http, $rootScope, $state, AuthService, PtrService, $ionicModal) {

  function startRefreshing() {
    if ($scope.transactions.length == 0) {
      PtrService.triggerPtr('t-refresher');
      setTimeout(function () {
        startRefreshing();
      }, 3000);
    }
  }

  (function ($) {
    $(document).ready(function () {
      KeyService.getKeys().then(function (keys) {
        $scope.handler = Plaid.create({
          clientName: 'Chill',
          env: keys.plaidEnv,
          product: ['transactions'],
          key: keys.plaidPublicKey,
          forceIframe: true,
          onSuccess: function onSuccess(public_token) {
            PtrService.triggerPtr('t-refresher');
            $http.post('/api/users/addBank', {
              public_token: public_token,
              lastLocation: $rootScope.lastLocation
            }).then(function (res) {
              AuthService.refreshSession().then(function (user) {
                console.log(user);
                startRefreshing();
              });
            }).then(null, $rootScope.err);
          },
          onExit: function onExit(error) {}
        });
      }).then(null, console.log);
    });
  })(jQuery);

  $scope.bankLogin = function () {
    if (!$rootScope.lastLocation && !$rootScope.user.locations.length) {
      navigator.notification.confirm("You need to go to settings to enable location services so we can accurately locate your transactions. The location data is never stored for more than 6 hours.", function (buttonIndex) {
        console.error(window.cordova.plugins.settings);
        console.error(buttonIndex);
        if (buttonIndex == 1) window.cordova.plugins.settings.open("location", function () {
          console.error('ok');
        }, function () {
          console.error('error');
        });
      }, "No Location", ["Settings", "Close"]);
      console.error('no location');
    } else {
      $scope.handler.open();
    }
  };

  $scope.getTransactions = function () {
    $http.get('/api/transactions/recent').then(function (res) {
      $scope.transactions = res.data;
      $scope.$broadcast('scroll.refreshComplete');
    }).then(null, $rootScope.err);
  };

  $rootScope.$on('resume', function () {
    console.error('resumed');
    $scope.getTransactions();
  });

  $scope.$on("$ionicView.loaded", function () {
    AuthService.getLoggedInUser().then(function (user) {
      if (!!user && !!user.bank.item) {
        PtrService.triggerPtr('t-refresher');
      }
    });
  });

  $ionicModal.fromTemplateUrl('/modals/createPost.html', {
    scope: $scope,
    animation: 'slide-in-up'
  }).then(function (modal) {
    $scope.modal = modal;
  });

  $scope.openModal = function () {
    $scope.modal.show();
  };
  $scope.closeModal = function () {
    $scope.modal.hide();
  };

  $scope.$on('$destroy', function () {
    $scope.modal.remove();
  });

  $scope.newPost = function (tran) {
    $scope.newTransaction = tran;
    if (tran.category) $scope.newTransaction.caption = tran.category[tran.category.length - 1];
    $scope.openModal();
  };

  $scope.submitTransaction = function () {
    $http.post('/api/transactions/post', $scope.newTransaction).then(function (res) {
      $scope.closeModal();
      AuthService.refreshSession().then(function (user) {
        PtrService.triggerPtr('t-refresher');
      });
    }).then(null, $rootScope.err);
  };

  $scope.deletePost = function (tran) {
    $http.post('/api/transactions/delete', tran).then(function (res) {
      PtrService.triggerPtr('t-refresher');
    }).then(null, $rootScope.err);
  };

  $scope.openMapCall = function (trans) {
    openMap(trans, $scope, $ionicModal, $http, "personal");
  };
});
app.config(function ($stateProvider, $urlRouterProvider) {
  $stateProvider.state('menu.tab', {
    url: '/tab',
    abstract: true,
    templateUrl: 'js/states/tabs/tabs.html'
  });

  // if none of the above states are matched, use this as the fallback
});
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImF1dGguanMiLCJtYXAuanMiLCJzZXJ2aWNlcy5qcyIsInN0YXRlcy9sb2dpbi9sb2dpbi5qcyIsInN0YXRlcy9wdWJsaWMvcHVibGljLmpzIiwic3RhdGVzL21lbnUvbWVudS5qcyIsInN0YXRlcy9wZXJzb25hbC9wZXJzb25hbC5qcyIsInN0YXRlcy90YWJzL3RhYnMuanMiXSwibmFtZXMiOlsicm9vdFVybCIsIndpbmRvdyIsImFwcCIsImFuZ3VsYXIiLCJtb2R1bGUiLCJjb250cm9sbGVyIiwiJHJvb3RTY29wZSIsInJ1biIsIiRjb3Jkb3ZhTmF0aXZlU3RvcmFnZSIsInN0b3JhZ2UiLCJjb25maWciLCIkaW9uaWNDbG91ZFByb3ZpZGVyIiwiaW5pdCIsIiR1cmxSb3V0ZXJQcm92aWRlciIsIiRodHRwUHJvdmlkZXIiLCJpbnRlcmNlcHRvcnMiLCJwdXNoIiwicmVxdWVzdCIsInVybCIsImNoYXJBdCIsInJlc3BvbnNlIiwicmVzIiwib3RoZXJ3aXNlIiwiJGlvbmljUGxhdGZvcm0iLCIkaHR0cCIsIkF1dGhTZXJ2aWNlIiwiS2V5U2VydmljZSIsIiRjb3Jkb3ZhUGluRGlhbG9nIiwicmVhZHkiLCJjb3Jkb3ZhIiwicGx1Z2lucyIsIktleWJvYXJkIiwiaGlkZUtleWJvYXJkQWNjZXNzb3J5QmFyIiwiZGlzYWJsZVNjcm9sbCIsIlN0YXR1c0JhciIsInN0eWxlRGVmYXVsdCIsImdldExvZ2dlZEluVXNlciIsInRoZW4iLCJ1c2VyIiwiZ2V0S2V5cyIsIm9uIiwiJGJyb2FkY2FzdCIsInJlZnJlc2hTZXNzaW9uIiwiJG9uIiwiZXZlbnQiLCJkYXRhIiwibG9naW5QaW4iLCJibGFja291dCIsImVudGVyUGluIiwiJCRwaGFzZSIsIiRhcHBseSIsImRvY3VtZW50IiwiYWRkRXZlbnRMaXN0ZW5lciIsImJnR2VvIiwiQmFja2dyb3VuZEdlb2xvY2F0aW9uIiwibG9jQ2FsbGJhY2siLCJsb2NhdGlvbiIsInRhc2tJRCIsImNvbnNvbGUiLCJlcnJvciIsImNvb3JkcyIsImxhdGl0dWRlIiwibG9uZ2l0dWRlIiwicG9zdCIsImZpbmlzaCIsImVyciIsImxhc3RMb2NhdGlvbiIsImxvY0ZhaWx1cmUiLCJjb25maWd1cmUiLCJkZXNpcmVkQWNjdXJhY3kiLCJkaXN0YW5jZUZpbHRlciIsInN0YXRpb25hcnlSYWRpdXMiLCJzdG9wT25UZXJtaW5hdGUiLCJzdGFydE9uQm9vdCIsInVzZVNpZ25pZmljYW50Q2hhbmdlc09ubHkiLCJzdGF0ZSIsImVuYWJsZWQiLCJzdGFydCIsIm91dHN0YW5kaW5nUGluIiwiY2hlY2tQaW4iLCJwcm9tcHQiLCJyZXN1bHRzIiwiYnV0dG9uSW5kZXgiLCJpbnB1dDEiLCJjaGVja1JhbmdlIiwicHJvcGVydHkiLCJtaW4iLCJtYXgiLCJsb2ciLCJtZXNzYWdlIiwiJCIsIlplYnJhX0RpYWxvZyIsInN0YXR1c1RleHQiLCJvbkRldmljZVJlYWR5Iiwib3BlbiIsIkluQXBwQnJvd3NlciIsImNvbnN0YW50IiwibG9naW5TdWNjZXNzIiwibG9naW5GYWlsZWQiLCJsb2dvdXRTdWNjZXNzIiwic2Vzc2lvblRpbWVvdXQiLCJub3RBdXRoZW50aWNhdGVkIiwibm90QXV0aG9yaXplZCIsImZhY3RvcnkiLCIkcSIsIkFVVEhfRVZFTlRTIiwic3RhdHVzRGljdCIsInJlc3BvbnNlRXJyb3IiLCJzdGF0dXMiLCJyZWplY3QiLCIkaW5qZWN0b3IiLCJnZXQiLCJzZXJ2aWNlIiwiU2Vzc2lvbiIsIm91dHN0YW5kaW5nUmVxdWVzdCIsImVuc3VyZVBhc3N3b3JkIiwiUHJvbWlzZSIsInJlc29sdmUiLCJsZW5ndGgiLCJhbGVydCIsInB1dCIsIm9uU3VjY2Vzc2Z1bExvZ2luIiwiY3JlYXRlIiwiaWQiLCJsb2NhdGlvbnMiLCJzZXRJdGVtIiwiX2lkIiwidW5kZWZpbmVkIiwiaXNBdXRoZW50aWNhdGVkIiwiZ2V0SXRlbSIsInZhbCIsImpRdWVyeSIsInBhcmFtIiwidWlkIiwiZSIsImNhdGNoIiwiZnJvbVNlcnZlciIsIndoZW4iLCJsb2dpbiIsImNyZWRlbnRpYWxzIiwibG9nb3V0IiwiZGVzdHJveSIsInJlbW92ZSIsInNlbGYiLCJzZXNzaW9uSWQiLCJrZXlzIiwib3Blbk1hcCIsInRyYW5zIiwiJHNjb3BlIiwiJGlvbmljTW9kYWwiLCJ0eXBlIiwic2VsZWN0ZWRUcmFucyIsImZyb21UZW1wbGF0ZVVybCIsInNjb3BlIiwiYW5pbWF0aW9uIiwibW9kYWwiLCJtYXBNb2RhbCIsImNsb3NlTWFwIiwibWFwIiwicG9wdXAiLCJnZXRFbGVtZW50QnlJZCIsInBhcmVudE5vZGUiLCJyZW1vdmVDaGlsZCIsImhpZGUiLCJzaG93IiwidXNlcklEIiwidHJhbnNhY3Rpb25zIiwiTCIsIm1hcGJveCIsImFjY2Vzc1Rva2VuIiwic2V0VmlldyIsImxhdCIsImxvbiIsIm1hcmtlcnMiLCJNYXJrZXJDbHVzdGVyR3JvdXAiLCJmb3JFYWNoIiwidCIsInRpdGxlIiwiZ2VuZXJhdGVUaXRsZSIsIm1hcmtlciIsIkxhdExuZyIsImljb24iLCJiaW5kUG9wdXAiLCJhZGRMYXllciIsInNldExhdExuZyIsInNldENvbnRlbnQiLCJvcGVuT24iLCJ0cmFuIiwibmFtZSIsImNhcHRpb24iLCJhbW91bnQiLCJ0b0ZpeGVkIiwicGhvdG9zIiwicmVkdWNlIiwic3VtIiwicCIsImNoYXRzIiwibGFzdFRleHQiLCJmYWNlIiwiYWxsIiwiY2hhdCIsInNwbGljZSIsImluZGV4T2YiLCJjaGF0SWQiLCJpIiwicGFyc2VJbnQiLCIkdGltZW91dCIsIiRpb25pY1Njcm9sbERlbGVnYXRlIiwidHJpZ2dlclB0ciIsImRlbGVnYXRlSGFuZGxlIiwic2Nyb2xsVmlldyIsIiRnZXRCeUhhbmRsZSIsImdldFNjcm9sbFZpZXciLCJfX3B1Ymxpc2giLCJfX3Njcm9sbExlZnQiLCJfX3JlZnJlc2hIZWlnaHQiLCJfX3pvb21MZXZlbCIsImQiLCJEYXRlIiwicmVmcmVzaFN0YXJ0VGltZSIsImdldFRpbWUiLCJfX3JlZnJlc2hBY3RpdmUiLCJfX3JlZnJlc2hIaWRkZW4iLCJfX3JlZnJlc2hTaG93IiwiX19yZWZyZXNoQWN0aXZhdGUiLCJfX3JlZnJlc2hTdGFydCIsIiRzdGF0ZVByb3ZpZGVyIiwidmlld3MiLCJ0ZW1wbGF0ZVVybCIsIiRzdGF0ZSIsIlB0clNlcnZpY2UiLCIkd2luZG93IiwiJGlvbmljUHVzaCIsIiRsb2NhdGlvbiIsInMiLCJqcyIsImZqcyIsImdldEVsZW1lbnRzQnlUYWdOYW1lIiwiY3JlYXRlRWxlbWVudCIsInNyYyIsImluc2VydEJlZm9yZSIsInJlZ2lzdGVyUHVzaCIsInJlZ2lzdGVyIiwicHVzaFRva2VuIiwidG9rZW4iLCJmYWNlYm9vayIsImdldFRyYW5zYWN0aW9ucyIsInNvcnQiLCJhIiwiYiIsImRhdGUiLCJmYkxvZ2luIiwibG9naW5XaW5kb3ciLCJlbmNvZGVVUkkiLCJpbmNsdWRlcyIsImNsb3NlIiwicmVsb2FkIiwib3Blbk1hcENhbGwiLCJjcmVhdGVDb21tZW50IiwibmV3Q29tbWVudCIsInRleHQiLCJjb21tZW50cyIsInB1cnBvc2UiLCJsaWtlIiwibGlrZXMiLCJhYnN0cmFjdCIsIm9wZW5Nb2RhbCIsImNsb3NlTW9kYWwiLCJ1bmxpbmtCYW5rIiwic3RhcnRSZWZyZXNoaW5nIiwic2V0VGltZW91dCIsImhhbmRsZXIiLCJQbGFpZCIsImNsaWVudE5hbWUiLCJlbnYiLCJwbGFpZEVudiIsInByb2R1Y3QiLCJrZXkiLCJwbGFpZFB1YmxpY0tleSIsImZvcmNlSWZyYW1lIiwib25TdWNjZXNzIiwicHVibGljX3Rva2VuIiwib25FeGl0IiwiYmFua0xvZ2luIiwibmF2aWdhdG9yIiwibm90aWZpY2F0aW9uIiwiY29uZmlybSIsInNldHRpbmdzIiwiYmFuayIsIml0ZW0iLCJuZXdQb3N0IiwibmV3VHJhbnNhY3Rpb24iLCJjYXRlZ29yeSIsInN1Ym1pdFRyYW5zYWN0aW9uIiwiZGVsZXRlUG9zdCJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxJQUFBQSxVQUFBLHNCQUFBLEMs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QUFBLEVBQ0E5UCxJQURBLENBQ0EsVUFBQWhCLEdBQUEsRUFBQTtBQUNBK0gsYUFBQXVILFVBQUE7QUFDQWxQLGtCQUFBaUIsY0FBQSxHQUFBTCxJQUFBLENBQUEsVUFBQUMsSUFBQSxFQUFBO0FBQ0FnTSxtQkFBQXRCLFVBQUEsQ0FBQSxhQUFBO0FBQ0EsT0FGQTtBQUdBLEtBTkEsRUFNQTNLLElBTkEsQ0FNQSxJQU5BLEVBTUEvQixXQUFBMkQsR0FOQTtBQU9BLEdBUkE7O0FBVUFtRixTQUFBa0osVUFBQSxHQUFBLFVBQUEzRyxJQUFBLEVBQUE7QUFDQW5LLFVBQUF1QyxJQUFBLENBQUEsMEJBQUEsRUFBQTRILElBQUEsRUFDQXRKLElBREEsQ0FDQSxVQUFBaEIsR0FBQSxFQUFBO0FBQ0FpTixpQkFBQXRCLFVBQUEsQ0FBQSxhQUFBO0FBQ0EsS0FIQSxFQUdBM0ssSUFIQSxDQUdBLElBSEEsRUFHQS9CLFdBQUEyRCxHQUhBO0FBSUEsR0FMQTs7QUFRQW1GLFNBQUE2RyxXQUFBLEdBQUEsVUFBQTlHLEtBQUEsRUFBQTtBQUNBRCxZQUFBQyxLQUFBLEVBQUFDLE1BQUEsRUFBQUMsV0FBQSxFQUFBN0gsS0FBQSxFQUFBLFVBQUE7QUFDQSxHQUZBO0FBSUEsQ0F0SUE7QUNBQXRCLElBQUFRLE1BQUEsQ0FBQSxVQUFBd04sY0FBQSxFQUFBck4sa0JBQUEsRUFBQTtBQUNBcU4saUJBQ0F2SixLQURBLENBQ0EsVUFEQSxFQUNBO0FBQ0F6RCxTQUFBLE1BREE7QUFFQXVQLGNBQUEsSUFGQTtBQUdBckMsaUJBQUE7QUFIQSxHQURBOztBQU9BO0FBQ0EsQ0FUQSIsImZpbGUiOiJtYWluLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8gSW9uaWMgU3RhcnRlciBBcHBcbi8vIGFuZ3VsYXIubW9kdWxlIGlzIGEgZ2xvYmFsIHBsYWNlIGZvciBjcmVhdGluZywgcmVnaXN0ZXJpbmcgYW5kIHJldHJpZXZpbmcgQW5ndWxhciBtb2R1bGVzXG4vLyAnc3RhcnRlcicgaXMgdGhlIG5hbWUgb2YgdGhpcyBhbmd1bGFyIG1vZHVsZSBleGFtcGxlIChhbHNvIHNldCBpbiBhIDxib2R5PiBhdHRyaWJ1dGUgaW4gaW5kZXguaHRtbClcbi8vIHRoZSAybmQgcGFyYW1ldGVyIGlzIGFuIGFycmF5IG9mICdyZXF1aXJlcydcbi8vICdzdGFydGVyLnNlcnZpY2VzJyBpcyBmb3VuZCBpbiBzZXJ2aWNlcy5qc1xuLy8gJ3N0YXJ0ZXIuY29udHJvbGxlcnMnIGlzIGZvdW5kIGluIGNvbnRyb2xsZXJzLmpzXG5cbi8vIHZhciByb290VXJsID0gXCJodHRwOi8vbG9jYWxob3N0OjgwMDBcIjsgLy9icm93c2VyL3NpbXVsYXRvciBkZXZlbG9wbWVudFxudmFyIHJvb3RVcmwgPSBcImh0dHBzOi8vbWlua2NoYXQuY29tXCI7IC8vcHJvZHVjdGlvblxud2luZG93LmFwcCA9IGFuZ3VsYXIubW9kdWxlKCdzdGFydGVyJywgWydpb25pYycsICdpb25pYy5jbG91ZCcsICduZ0NvcmRvdmEnLCAnbmdDb3Jkb3ZhLnBsdWdpbnMubmF0aXZlU3RvcmFnZScsICduZ0NvcmRvdmEucGx1Z2lucy5waW5EaWFsb2cnXSlcbi5jb250cm9sbGVyKCdBcHBDb250cm9sbGVyJywgZnVuY3Rpb24oJHJvb3RTY29wZSkge30pXG4ucnVuKGZ1bmN0aW9uKCRjb3Jkb3ZhTmF0aXZlU3RvcmFnZSkge1xuICB3aW5kb3cuc3RvcmFnZSA9ICRjb3Jkb3ZhTmF0aXZlU3RvcmFnZTtcbn0pXG4uY29uZmlnKGZ1bmN0aW9uKCRpb25pY0Nsb3VkUHJvdmlkZXIpIHtcbiAgJGlvbmljQ2xvdWRQcm92aWRlci5pbml0KHtcbiAgICBcImNvcmVcIjoge1xuICAgICAgXCJhcHBfaWRcIjogXCJlZjhhZTQyMFwiXG4gICAgfSxcbiAgICBcInB1c2hcIjoge1xuICAgICAgXCJzZW5kZXJfaWRcIjogXCIxMjM4OTAwOTgzMjFcIixcbiAgICAgIFwicGx1Z2luQ29uZmlnXCI6IHtcbiAgICAgICAgXCJpb3NcIjoge1xuICAgICAgICAgIFwiYmFkZ2VcIjogdHJ1ZSxcbiAgICAgICAgICBcInNvdW5kXCI6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgXCJhbmRyb2lkXCI6IHtcbiAgICAgICAgICBcImljb25Db2xvclwiOiBcIiMzNDM0MzRcIlxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KTtcbn0pXG4uY29uZmlnKGZ1bmN0aW9uKCR1cmxSb3V0ZXJQcm92aWRlciwgJGh0dHBQcm92aWRlcikge1xuICAgIC8vY29tbWVudCBvdXQgZm9yIGRldlxuICAgICRodHRwUHJvdmlkZXIuaW50ZXJjZXB0b3JzLnB1c2goZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICByZXF1ZXN0OiBmdW5jdGlvbihjb25maWcpIHtcbiAgICAgICAgICBjb25maWcudXJsID0gcm9vdFVybCArIChjb25maWcudXJsLmNoYXJBdCgwKSA9PSAnLycgPyAnJyA6ICcvJykgKyBjb25maWcudXJsO1xuICAgICAgICAgIHJldHVybiBjb25maWc7XG4gICAgICAgIH0sXG4gICAgICAgIHJlc3BvbnNlOiBmdW5jdGlvbihyZXMpIHtcbiAgICAgICAgICByZXR1cm4gcmVzO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuXG4gICAgJHVybFJvdXRlclByb3ZpZGVyLm90aGVyd2lzZSgnL21lbnUvdGFiL3B1YmxpYycpO1xuICB9KVxuLnJ1bihmdW5jdGlvbigkaW9uaWNQbGF0Zm9ybSwgJGh0dHAsICRyb290U2NvcGUsIEF1dGhTZXJ2aWNlLCBLZXlTZXJ2aWNlLCAkY29yZG92YU5hdGl2ZVN0b3JhZ2UsICRjb3Jkb3ZhUGluRGlhbG9nKSB7XG4gICRpb25pY1BsYXRmb3JtLnJlYWR5KGZ1bmN0aW9uKCkge1xuICAgICAgLy8gSGlkZSB0aGUgYWNjZXNzb3J5IGJhciBieSBkZWZhdWx0IChyZW1vdmUgdGhpcyB0byBzaG93IHRoZSBhY2Nlc3NvcnkgYmFyIGFib3ZlIHRoZSBrZXlib2FyZFxuICAgICAgLy8gZm9yIGZvcm0gaW5wdXRzKVxuICAgICAgaWYgKHdpbmRvdy5jb3Jkb3ZhICYmIHdpbmRvdy5jb3Jkb3ZhLnBsdWdpbnMgJiYgd2luZG93LmNvcmRvdmEucGx1Z2lucy5LZXlib2FyZCkge1xuICAgICAgICBjb3Jkb3ZhLnBsdWdpbnMuS2V5Ym9hcmQuaGlkZUtleWJvYXJkQWNjZXNzb3J5QmFyKHRydWUpO1xuICAgICAgICBjb3Jkb3ZhLnBsdWdpbnMuS2V5Ym9hcmQuZGlzYWJsZVNjcm9sbCh0cnVlKTtcbiAgICAgIH1cbiAgICAgIGlmICh3aW5kb3cuU3RhdHVzQmFyKSB7XG4gICAgICAgIC8vIG9yZy5hcGFjaGUuY29yZG92YS5zdGF0dXNiYXIgcmVxdWlyZWRcbiAgICAgICAgU3RhdHVzQmFyLnN0eWxlRGVmYXVsdCgpO1xuICAgICAgfVxuICAgICAgQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKCkudGhlbihmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgICRyb290U2NvcGUudXNlciA9IHVzZXI7XG4gICAgICB9KTtcblxuICAgICAgS2V5U2VydmljZS5nZXRLZXlzKCk7XG5cbiAgICAgICRpb25pY1BsYXRmb3JtLm9uKCdyZXN1bWUnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdyZXN1bWUnKTtcbiAgICAgICAgQXV0aFNlcnZpY2UucmVmcmVzaFNlc3Npb24oKTtcbiAgICAgICAgJHJvb3RTY29wZS4kb24oJ3VzZXIgbG9hZGVkJywgZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICAgICAgICBpZiAoJHJvb3RTY29wZS51c2VyICYmICRyb290U2NvcGUudXNlci5sb2dpblBpbiAmJiB3aW5kb3cuY29yZG92YSAmJiAkcm9vdFNjb3BlLmJsYWNrb3V0KSBlbnRlclBpbigpO1xuICAgICAgICB9KVxuICAgICAgICBpZiAoJHJvb3RTY29wZS51c2VyICYmICRyb290U2NvcGUudXNlci5sb2dpblBpbiAmJiB3aW5kb3cuY29yZG92YSAmJiAkcm9vdFNjb3BlLmJsYWNrb3V0KSBlbnRlclBpbigpO1xuICAgICAgfSlcbiAgICAgICRpb25pY1BsYXRmb3JtLm9uKCdwYXVzZScsIGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgICAgIGlmICgkcm9vdFNjb3BlLnVzZXIgJiYgJHJvb3RTY29wZS51c2VyLmxvZ2luUGluKSAkcm9vdFNjb3BlLmJsYWNrb3V0ID0gdHJ1ZTtcbiAgICAgICAgaWYgKCEkcm9vdFNjb3BlLiQkcGhhc2UpICRyb290U2NvcGUuJGFwcGx5KCk7XG4gICAgICB9KVxuICAgIH0pO1xuXG5cblxuICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdkZXZpY2VyZWFkeScsIGZ1bmN0aW9uKCkge1xuXG4gICAgdmFyIGJnR2VvID0gd2luZG93LkJhY2tncm91bmRHZW9sb2NhdGlvbjtcblxuICAgIHdpbmRvdy5sb2NDYWxsYmFjayA9IGZ1bmN0aW9uKGxvY2F0aW9uLCB0YXNrSUQpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tqc10gQmFja2dyb3VuZEdlb2xvY2F0aW9uIGNhbGxiYWNrOiAgJyArIGxvY2F0aW9uLmNvb3Jkcy5sYXRpdHVkZSArICcsJyArIGxvY2F0aW9uLmNvb3Jkcy5sb25naXR1ZGUpO1xuICAgICAgaWYgKGxvY2F0aW9uLmNvb3Jkcy5sb25naXR1ZGUpIHtcbiAgICAgICAgJGh0dHAucG9zdCgnL2FwaS91c2Vycy9sb2NhdGlvbicsIGxvY2F0aW9uLmNvb3JkcylcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzKSB7XG4gICAgICAgICAgYmdHZW8uZmluaXNoKHRhc2tJRCk7XG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKG51bGwsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgICAgICAkcm9vdFNjb3BlLmxhc3RMb2NhdGlvbiA9IGxvY2F0aW9uLmNvb3JkcztcbiAgICAgICAgICBiZ0dlby5maW5pc2godGFza0lEKTtcbiAgICAgICAgfSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJnR2VvLmZpbmlzaCh0YXNrSUQpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICB3aW5kb3cubG9jRmFpbHVyZSA9IGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdCYWNrZ3JvdW5kR2VvbG9jYXRpb24gZXJyb3InKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgIH07XG5cbiAgICBiZ0dlby5jb25maWd1cmUoe1xuICAgICAgZGVzaXJlZEFjY3VyYWN5OiAxMDAsXG4gICAgICBkaXN0YW5jZUZpbHRlcjogMzAsXG4gICAgICBzdGF0aW9uYXJ5UmFkaXVzOiAyMDAsXG4gICAgICBzdG9wT25UZXJtaW5hdGU6IGZhbHNlLFxuICAgICAgc3RhcnRPbkJvb3Q6IHRydWUsXG4gICAgICB1c2VTaWduaWZpY2FudENoYW5nZXNPbmx5OiB0cnVlXG4gICAgfSwgZnVuY3Rpb24oc3RhdGUpIHtcbiAgICAgIGlmICghc3RhdGUuZW5hYmxlZCkge1xuICAgICAgICBiZ0dlby5zdGFydCgpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgYmdHZW8ub24oJ2xvY2F0aW9uJywgd2luZG93LmxvY0NhbGxiYWNrLCB3aW5kb3cubG9jRmFpbHVyZSk7XG5cbiAgfSwgdHJ1ZSk7XG5cbiAgdmFyIG91dHN0YW5kaW5nUGluID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZW50ZXJQaW4oKSB7XG4gICAgZnVuY3Rpb24gY2hlY2tQaW4oKSB7XG4gICAgICAkY29yZG92YVBpbkRpYWxvZy5wcm9tcHQoXCJFbnRlciB5b3VyIHBpblwiLCBcIkVudGVyIFBpblwiKS50aGVuKGZ1bmN0aW9uKHJlc3VsdHMpIHtcbiAgICAgICAgaWYgKHJlc3VsdHMuYnV0dG9uSW5kZXggPT0gMSAmJiByZXN1bHRzLmlucHV0MSAhPSAkcm9vdFNjb3BlLnVzZXIubG9naW5QaW4pIGNoZWNrUGluKCk7XG4gICAgICAgIGVsc2UgaWYgKHJlc3VsdHMuYnV0dG9uSW5kZXggPT0gMikgY2hlY2tQaW4oKTtcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgb3V0c3RhbmRpbmdQaW4gPSBmYWxzZTtcbiAgICAgICAgICAkcm9vdFNjb3BlLmJsYWNrb3V0ID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH0pLnRoZW4obnVsbCwgY29uc29sZS5lcnJvcik7XG4gICAgfVxuICAgIGlmICghb3V0c3RhbmRpbmdQaW4pIHtcbiAgICAgIG91dHN0YW5kaW5nUGluID0gdHJ1ZTtcbiAgICAgIGNoZWNrUGluKCk7XG4gICAgfVxuICB9XG59KVxuXG5cbmFwcC5ydW4oZnVuY3Rpb24oJHJvb3RTY29wZSkge1xuICAkcm9vdFNjb3BlLmNoZWNrUmFuZ2UgPSBmdW5jdGlvbihwcm9wZXJ0eSwgbWluLCBtYXgpIHtcbiAgICBpZiAocHJvcGVydHkgPCBtaW4pIHJldHVybiBtaW47XG4gICAgaWYgKHByb3BlcnR5ID4gbWF4KSByZXR1cm4gbWF4O1xuICAgIHJldHVybiBwcm9wZXJ0eTtcbiAgfVxuXG4gICRyb290U2NvcGUuZXJyID0gZnVuY3Rpb24oZXJyKSB7XG4gICAgY29uc29sZS5sb2coZXJyKTtcbiAgICBpZiAoZXJyLm1lc3NhZ2UpICQuWmVicmFfRGlhbG9nKGVyci5tZXNzYWdlKTtcbiAgICBlbHNlIGlmIChlcnIuZGF0YSkgJC5aZWJyYV9EaWFsb2coZXJyLmRhdGEpO1xuICAgIGVsc2UgJC5aZWJyYV9EaWFsb2coZXJyLnN0YXR1c1RleHQpO1xuICB9XG5cbn0pO1xuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiZGV2aWNlcmVhZHlcIiwgb25EZXZpY2VSZWFkeSwgZmFsc2UpO1xuXG5mdW5jdGlvbiBvbkRldmljZVJlYWR5KCkge1xuICB3aW5kb3cub3BlbiA9IGNvcmRvdmEuSW5BcHBCcm93c2VyLm9wZW47XG59IiwiYXBwLmNvbnN0YW50KCdBVVRIX0VWRU5UUycsIHtcbiAgbG9naW5TdWNjZXNzOiAnYXV0aC1sb2dpbi1zdWNjZXNzJyxcbiAgbG9naW5GYWlsZWQ6ICdhdXRoLWxvZ2luLWZhaWxlZCcsXG4gIGxvZ291dFN1Y2Nlc3M6ICdhdXRoLWxvZ291dC1zdWNjZXNzJyxcbiAgc2Vzc2lvblRpbWVvdXQ6ICdhdXRoLXNlc3Npb24tdGltZW91dCcsXG4gIG5vdEF1dGhlbnRpY2F0ZWQ6ICdhdXRoLW5vdC1hdXRoZW50aWNhdGVkJyxcbiAgbm90QXV0aG9yaXplZDogJ2F1dGgtbm90LWF1dGhvcml6ZWQnXG59KTtcblxuYXBwLmZhY3RvcnkoJ0F1dGhJbnRlcmNlcHRvcicsIGZ1bmN0aW9uKCRyb290U2NvcGUsICRxLCBBVVRIX0VWRU5UUykge1xuICB2YXIgc3RhdHVzRGljdCA9IHtcbiAgICA0MDE6IEFVVEhfRVZFTlRTLm5vdEF1dGhlbnRpY2F0ZWQsXG4gICAgNDAzOiBBVVRIX0VWRU5UUy5ub3RBdXRob3JpemVkLFxuICAgIDQxOTogQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsXG4gICAgNDQwOiBBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dFxuICB9O1xuICByZXR1cm4ge1xuICAgIHJlc3BvbnNlRXJyb3I6IGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG4gICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3Qoc3RhdHVzRGljdFtyZXNwb25zZS5zdGF0dXNdLCByZXNwb25zZSk7XG4gICAgICByZXR1cm4gJHEucmVqZWN0KHJlc3BvbnNlKVxuICAgIH1cbiAgfTtcbn0pO1xuXG5hcHAuY29uZmlnKGZ1bmN0aW9uKCRodHRwUHJvdmlkZXIpIHtcbiAgJGh0dHBQcm92aWRlci5pbnRlcmNlcHRvcnMucHVzaChbXG4gICAgJyRpbmplY3RvcicsXG4gICAgZnVuY3Rpb24oJGluamVjdG9yKSB7XG4gICAgICByZXR1cm4gJGluamVjdG9yLmdldCgnQXV0aEludGVyY2VwdG9yJyk7XG4gICAgfVxuICAgIF0pO1xufSk7XG5cbmFwcC5zZXJ2aWNlKCdBdXRoU2VydmljZScsIGZ1bmN0aW9uKCRodHRwLCBTZXNzaW9uLCAkcm9vdFNjb3BlLCBBVVRIX0VWRU5UUywgJHEsICRpb25pY1BsYXRmb3JtLCAkY29yZG92YU5hdGl2ZVN0b3JhZ2UsICRjb3Jkb3ZhUGluRGlhbG9nKSB7XG5cbiAgdmFyIG91dHN0YW5kaW5nUmVxdWVzdDtcblxuICBmdW5jdGlvbiBlbnN1cmVQYXNzd29yZCh1c2VyKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgaWYgKHdpbmRvdy5jb3Jkb3ZhICYmICF1c2VyLmxvZ2luUGluKSB7XG4gICAgICAgICRjb3Jkb3ZhUGluRGlhbG9nLnByb21wdChcIkVudGVyIGEgcGluXCIsIFwiRW50ZXIgUGluXCIpLnRoZW4oZnVuY3Rpb24ocmVzdWx0cykge1xuICAgICAgICAgIGlmIChyZXN1bHRzLmJ1dHRvbkluZGV4ID09IDEpIHtcbiAgICAgICAgICAgIGlmIChyZXN1bHRzLmlucHV0MS5sZW5ndGggPCA0KSB7XG4gICAgICAgICAgICAgIGFsZXJ0KFwiTmVlZHMgYXQgbGVhc3QgNCBkaWdpdHNcIik7XG4gICAgICAgICAgICAgIGVuc3VyZVBhc3N3b3JkKHVzZXIpLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICRodHRwLnB1dCgnL2FwaS91c2Vycy91cGRhdGUnLCB7XG4gICAgICAgICAgICAgICAgbG9naW5QaW46IHJlc3VsdHMuaW5wdXQxXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKHJlcykge1xuICAgICAgICAgICAgICAgIHJlc29sdmUocmVzLmRhdGEpO1xuICAgICAgICAgICAgICB9KS50aGVuKG51bGwsIGNvbnNvbGUuZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocmVzdWx0cy5idXR0b25JbmRleCA9PSAyKSB7XG4gICAgICAgICAgICBlbnN1cmVQYXNzd29yZCh1c2VyKS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KS50aGVuKG51bGwsIGNvbnNvbGUuZXJyb3IpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzb2x2ZSh1c2VyKTtcbiAgICAgIH1cbiAgICB9KVxuICB9XG5cbiAgZnVuY3Rpb24gb25TdWNjZXNzZnVsTG9naW4ocmVzcG9uc2UpIHtcbiAgICByZXR1cm4gZW5zdXJlUGFzc3dvcmQocmVzcG9uc2UuZGF0YS51c2VyKVxuICAgIC50aGVuKGZ1bmN0aW9uKHVzZXIpIHtcbiAgICAgIFNlc3Npb24uY3JlYXRlKHJlc3BvbnNlLmRhdGEuaWQsIHVzZXIpO1xuICAgICAgJHJvb3RTY29wZS51c2VyID0gdXNlcjtcbiAgICAgIGlmICghdXNlci5sb2NhdGlvbnMgfHwgIXVzZXIubG9jYXRpb25zLmxlbmd0aCkge1xuICAgICAgICAkaHR0cC5wb3N0KCcvYXBpL3VzZXJzL2xvY2F0aW9uJywgbG9jYXRpb24pXG4gICAgICB9XG4gICAgICAkaW9uaWNQbGF0Zm9ybS5yZWFkeShmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKCRyb290U2NvcGUudXNlcikge1xuICAgICAgICAgICRjb3Jkb3ZhTmF0aXZlU3RvcmFnZS5zZXRJdGVtKFwidWlkXCIsICRyb290U2NvcGUudXNlci5faWQpO1xuICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgndXNlciBsb2FkZWQnKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoQVVUSF9FVkVOVFMubG9naW5TdWNjZXNzKTtcbiAgICAgIG91dHN0YW5kaW5nUmVxdWVzdCA9IHVuZGVmaW5lZDtcbiAgICAgIHJldHVybiB1c2VyO1xuICAgIH0pLnRoZW4obnVsbCwgY29uc29sZS5lcnJvcik7XG4gIH1cblxuICAvLyBVc2VzIHRoZSBzZXNzaW9uIGZhY3RvcnkgdG8gc2VlIGlmIGFuXG4gIC8vIGF1dGhlbnRpY2F0ZWQgdXNlciBpcyBjdXJyZW50bHkgcmVnaXN0ZXJlZC5cbiAgdGhpcy5pc0F1dGhlbnRpY2F0ZWQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gISFTZXNzaW9uLnVzZXI7XG4gIH07XG5cbiAgdGhpcy5yZWZyZXNoU2Vzc2lvbiA9IGZ1bmN0aW9uKCkge1xuICAgIGlmIChvdXRzdGFuZGluZ1JlcXVlc3QpIHJldHVybiBvdXRzdGFuZGluZ1JlcXVlc3Q7XG4gICAgcmV0dXJuIG91dHN0YW5kaW5nUmVxdWVzdCA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgJGlvbmljUGxhdGZvcm0ucmVhZHkoZnVuY3Rpb24oKSB7XG4gICAgICAgIC8vICRjb3Jkb3ZhTmF0aXZlU3RvcmFnZS5zZXRJdGVtKFwidWlkXCIsIFwiXCIpLnRoZW4oZnVuY3Rpb24oKSB7IC8vYXV0b2xvZ2luXG4gICAgICAgICAgJGNvcmRvdmFOYXRpdmVTdG9yYWdlLmdldEl0ZW0oXCJ1aWRcIikudGhlbihmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9zZXNzaW9uPycgKyBqUXVlcnkucGFyYW0oe1xuICAgICAgICAgICAgICB1aWQ6IHZhbFxuICAgICAgICAgICAgfSkpXG4gICAgICAgICAgfSkudGhlbihudWxsLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBpZiAoZS5zdGF0dXMgIT0gNDAxKSByZXR1cm4gJGh0dHAuZ2V0KCcvc2Vzc2lvbicpO1xuICAgICAgICAgICAgZWxzZSB0aHJvdyAoZSk7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAudGhlbihvblN1Y2Nlc3NmdWxMb2dpbikudGhlbihyZXNvbHZlKS5jYXRjaChmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICByZXNvbHZlKG51bGwpO1xuICAgICAgICAgICAgb3V0c3RhbmRpbmdSZXF1ZXN0ID0gdW5kZWZpbmVkO1xuICAgICAgICAgIH0pO1xuICAgICAgICAvLyB9KSAvL3JlbW92ZVxuICAgICAgfSlcbiAgICB9KVxuICB9XG5cbiAgdGhpcy5nZXRMb2dnZWRJblVzZXIgPSBmdW5jdGlvbihmcm9tU2VydmVyKSB7XG5cbiAgICAvLyBJZiBhbiBhdXRoZW50aWNhdGVkIHNlc3Npb24gZXhpc3RzLCB3ZVxuICAgIC8vIHJldHVybiB0aGUgdXNlciBhdHRhY2hlZCB0byB0aGF0IHNlc3Npb25cbiAgICAvLyB3aXRoIGEgcHJvbWlzZS4gVGhpcyBlbnN1cmVzIHRoYXQgd2UgY2FuXG4gICAgLy8gYWx3YXlzIGludGVyZmFjZSB3aXRoIHRoaXMgbWV0aG9kIGFzeW5jaHJvbm91c2x5LlxuXG4gICAgLy8gT3B0aW9uYWxseSwgaWYgdHJ1ZSBpcyBnaXZlbiBhcyB0aGUgZnJvbVNlcnZlciBwYXJhbWV0ZXIsXG4gICAgLy8gdGhlbiB0aGlzIGNhY2hlZCB2YWx1ZSB3aWxsIG5vdCBiZSB1c2VkLlxuXG4gICAgaWYgKHRoaXMuaXNBdXRoZW50aWNhdGVkKCkgJiYgZnJvbVNlcnZlciAhPT0gdHJ1ZSkge1xuICAgICAgcmV0dXJuICRxLndoZW4oU2Vzc2lvbi51c2VyKTtcbiAgICB9XG5cbiAgICAvLyBNYWtlIHJlcXVlc3QgR0VUIC9zZXNzaW9uLlxuICAgIC8vIElmIGl0IHJldHVybnMgYSB1c2VyLCBjYWxsIG9uU3VjY2Vzc2Z1bExvZ2luIHdpdGggdGhlIHJlc3BvbnNlLlxuICAgIC8vIElmIGl0IHJldHVybnMgYSA0MDEgcmVzcG9uc2UsIHdlIGNhdGNoIGl0IGFuZCBpbnN0ZWFkIHJlc29sdmUgdG8gbnVsbC5cbiAgICByZXR1cm4gdGhpcy5yZWZyZXNoU2Vzc2lvbigpO1xuXG4gIH07XG5cbiAgdGhpcy5sb2dpbiA9IGZ1bmN0aW9uKGNyZWRlbnRpYWxzKSB7XG4gICAgcmV0dXJuICRodHRwLnBvc3QoJy9sb2dpbicsIGNyZWRlbnRpYWxzKVxuICAgIC50aGVuKG9uU3VjY2Vzc2Z1bExvZ2luKVxuICAgIC5jYXRjaChmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiAkcS5yZWplY3Qoe1xuICAgICAgICBtZXNzYWdlOiAnSW52YWxpZCBsb2dpbiBjcmVkZW50aWFscy4nXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfTtcblxuICB0aGlzLmxvZ291dCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAkaHR0cC5nZXQoJy9sb2dvdXQnKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgU2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgICAkY29yZG92YU5hdGl2ZVN0b3JhZ2UucmVtb3ZlKFwidWlkXCIpO1xuICAgICAgJHJvb3RTY29wZS51c2VyID0gdW5kZWZpbmVkO1xuICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KEFVVEhfRVZFTlRTLmxvZ291dFN1Y2Nlc3MpO1xuICAgIH0pO1xuICB9O1xuXG59KVxuXG5hcHAuc2VydmljZSgnU2Vzc2lvbicsIGZ1bmN0aW9uKCRyb290U2NvcGUsIEFVVEhfRVZFTlRTKSB7XG5cbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLm5vdEF1dGhlbnRpY2F0ZWQsIGZ1bmN0aW9uKCkge1xuICAgIHNlbGYuZGVzdHJveSgpO1xuICB9KTtcblxuICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCwgZnVuY3Rpb24oKSB7XG4gICAgc2VsZi5kZXN0cm95KCk7XG4gIH0pO1xuXG4gIHRoaXMuaWQgPSBudWxsO1xuICB0aGlzLnVzZXIgPSBudWxsO1xuXG4gIHRoaXMuY3JlYXRlID0gZnVuY3Rpb24oc2Vzc2lvbklkLCB1c2VyKSB7XG4gICAgdGhpcy5pZCA9IHNlc3Npb25JZDtcbiAgICB0aGlzLnVzZXIgPSB1c2VyO1xuICB9O1xuXG4gIHRoaXMuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuaWQgPSBudWxsO1xuICAgIHRoaXMudXNlciA9IG51bGw7XG4gIH07XG5cbn0pO1xuXG5hcHAuc2VydmljZSgnS2V5U2VydmljZScsIGZ1bmN0aW9uKCRodHRwKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdGhpcy5rZXlzID0gdW5kZWZpbmVkO1xuICB0aGlzLmdldEtleXMgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICBpZiAoc2VsZi5rZXlzKSByZXNvbHZlKHNlbGYua2V5cyk7XG4gICAgICBlbHNlIHtcbiAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL2FwaS9wdWJsaWNLZXlzJylcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzKSB7XG4gICAgICAgICAgc2VsZi5rZXlzID0gcmVzLmRhdGE7XG4gICAgICAgICAgcmVzb2x2ZShzZWxmLmtleXMpO1xuICAgICAgICB9KS50aGVuKG51bGwsIGNvbnNvbGUubG9nKTtcbiAgICAgIH1cbiAgICB9KVxuICB9XG59KTsiLCIvL21hcCBzdHVmZlxuZnVuY3Rpb24gb3Blbk1hcCh0cmFucywgJHNjb3BlLCAkaW9uaWNNb2RhbCwgJGh0dHAsIHR5cGUpIHtcbiAgJHNjb3BlLnNlbGVjdGVkVHJhbnMgPSB0cmFucztcblxuICAkaW9uaWNNb2RhbC5mcm9tVGVtcGxhdGVVcmwoJy9tb2RhbHMvbWFwLmh0bWwnLCB7XG4gICAgc2NvcGU6ICRzY29wZSxcbiAgICBhbmltYXRpb246ICdzbGlkZS1pbi11cCdcbiAgfSkudGhlbihmdW5jdGlvbihtb2RhbCkge1xuICAgICRzY29wZS5tYXBNb2RhbCA9IG1vZGFsO1xuICAgICRzY29wZS5vcGVuTWFwKCk7XG4gIH0pO1xuXG4gICRzY29wZS5jbG9zZU1hcCA9IGZ1bmN0aW9uKCkge1xuICAgICRzY29wZS5tYXAucmVtb3ZlKCk7XG4gICAgdmFyIHBvcHVwID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21hcC1wb3BwdXAnKTtcbiAgICBwb3B1cC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHBvcHVwKTtcbiAgICAkc2NvcGUubWFwTW9kYWwuaGlkZSgpO1xuICB9O1xuXG4gIC8vIENsZWFudXAgdGhlIG1vZGFsIHdoZW4gd2UncmUgZG9uZSB3aXRoIGl0IVxuICAkc2NvcGUuJG9uKCckZGVzdHJveScsIGZ1bmN0aW9uKCkge1xuICAgICRzY29wZS5tb2RhbC5yZW1vdmUoKTtcbiAgfSk7XG5cbiAgLy9vcGVuXG4gICRzY29wZS5vcGVuTWFwID0gZnVuY3Rpb24oKSB7XG4gICAgJHNjb3BlLm1hcE1vZGFsLnNob3coKTtcbiAgICBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIGlmICh0eXBlID09IFwicHVibGljXCIpIHtcbiAgICAgICAgJGh0dHAuZ2V0KFwiL2FwaS90cmFuc2FjdGlvbnMvZm9yVXNlcj9cIiArIGpRdWVyeS5wYXJhbSh7XG4gICAgICAgICAgdWlkOiB0cmFucy51c2VySUQuX2lkXG4gICAgICAgIH0pKS50aGVuKGZ1bmN0aW9uKHJlcykge1xuICAgICAgICAgIHJlc29sdmUocmVzLmRhdGEpO1xuICAgICAgICB9KS50aGVuKG51bGwsIHJlamVjdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNvbHZlKCRzY29wZS50cmFuc2FjdGlvbnMpXG4gICAgICB9XG4gICAgfSlcbiAgICAudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICBMLm1hcGJveC5hY2Nlc3NUb2tlbiA9ICdway5leUoxSWpvaVkyOWhlWE5qZFdVaUxDSmhJam9pWTJvMGVYQXpOV0Y2TVhaM2JqTXpibXRwZG1kd2R6RmliU0o5LmhGU3J6RmF6OWgtSnVwdjR5SGg3X1EnO1xuICAgICAgJHNjb3BlLm1hcCA9IEwubWFwYm94Lm1hcCgnbWFwLXBvcHB1cCcsICdtYXBib3guc3RyZWV0cycpLnNldFZpZXcoW3RyYW5zLmxvY2F0aW9uLmxhdCwgdHJhbnMubG9jYXRpb24ubG9uXSwgMTUpO1xuICAgICAgdmFyIG1hcmtlcnMgPSBuZXcgTC5NYXJrZXJDbHVzdGVyR3JvdXAoKTtcbiAgICAgIHZhciBkYXRhID1cbiAgICAgIGRhdGEuZm9yRWFjaChmdW5jdGlvbih0KSB7XG4gICAgICAgIGlmICh0LmxvY2F0aW9uLmxhdCkge1xuICAgICAgICAgIHZhciB0aXRsZSA9IGdlbmVyYXRlVGl0bGUodCk7XG4gICAgICAgICAgdmFyIG1hcmtlciA9IEwubWFya2VyKG5ldyBMLkxhdExuZyh0LmxvY2F0aW9uLmxhdCwgdC5sb2NhdGlvbi5sb24pLCB7XG4gICAgICAgICAgICBpY29uOiBMLm1hcGJveC5tYXJrZXIuaWNvbih7fSksXG4gICAgICAgICAgICB0aXRsZTogdGl0bGVcbiAgICAgICAgICB9KVxuICAgICAgICAgIG1hcmtlci5iaW5kUG9wdXAodGl0bGUpO1xuICAgICAgICAgIG1hcmtlcnMuYWRkTGF5ZXIobWFya2VyKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgICRzY29wZS5tYXAuYWRkTGF5ZXIobWFya2Vycyk7XG5cbiAgICAgIHZhciB0aXRsZSA9IGdlbmVyYXRlVGl0bGUodHJhbnMpO1xuICAgICAgTC5wb3B1cCgpXG4gICAgICAuc2V0TGF0TG5nKFt0cmFucy5sb2NhdGlvbi5sYXQgKyAuMDAwMywgdHJhbnMubG9jYXRpb24ubG9uXSlcbiAgICAgIC5zZXRDb250ZW50KHRpdGxlKVxuICAgICAgLm9wZW5Pbigkc2NvcGUubWFwKTtcbiAgICB9KS50aGVuKG51bGwsIGNvbnNvbGUuZXJyb3IpO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2VuZXJhdGVUaXRsZSh0cmFuKSB7XG4gICAgcmV0dXJuIFwiPGRpdiBzdHlsZT0ndGV4dC1hbGlnbjpjZW50ZXInPjxoMz5cIiArIHRyYW4ubmFtZSArIFwiPC9oMz5cIiArICh0cmFuLmNhcHRpb24gPyAoXCI8aDQ+XCIgKyB0cmFuLmNhcHRpb24gKyBcIjwvaDQ+XCIpIDogXCJcIikgKyBcIjxoND4kXCIgKyB0cmFuLmFtb3VudC50b0ZpeGVkKDIpICsgXCI8L2g0PjxkaXYgc3R5bGU9J2hlaWdodDoxMDBweDsgd2lkdGg6MTAwJTsgbWluLXdpZHRoOjIwMHB4OyBvdmVyZmxvdzpzY3JvbGw7IG92ZXJmbG93LXk6aGlkZGVuOyAtd2Via2l0LW92ZXJmbG93LXNjcm9sbGluZzogdG91Y2g7Jz48ZGl2IHN0eWxlPSd0ZXh0LWFsaWduOmxlZnQ7IGJhY2tncm91bmQtY29sb3I6Z3JheTsgaGVpZ2h0OjEwMHB4OyB3aWR0aDoxMDAwMHB4Oyc+XCIgKyB0cmFuLnBob3Rvcy5yZWR1Y2UoZnVuY3Rpb24oc3VtLCBwKSB7XG4gICAgICByZXR1cm4gc3VtICsgXCI8aW1nIHN0eWxlPSdoZWlnaHQ6MTAwJScgc3JjPSdcIiArIHAgKyBcIicvPlwiO1xuICAgIH0sIFwiXCIpICsgXCI8L2Rpdj48L2Rpdj48LzwvZGl2PlwiO1xuICB9XG59IiwiYW5ndWxhci5tb2R1bGUoJ3N0YXJ0ZXIuc2VydmljZXMnLCBbXSlcblxuLmZhY3RvcnkoJ0NoYXRzJywgZnVuY3Rpb24oKSB7XG4gIC8vIE1pZ2h0IHVzZSBhIHJlc291cmNlIGhlcmUgdGhhdCByZXR1cm5zIGEgSlNPTiBhcnJheVxuXG4gIC8vIFNvbWUgZmFrZSB0ZXN0aW5nIGRhdGFcbiAgdmFyIGNoYXRzID0gW3tcbiAgICBpZDogMCxcbiAgICBuYW1lOiAnQmVuIFNwYXJyb3cnLFxuICAgIGxhc3RUZXh0OiAnWW91IG9uIHlvdXIgd2F5PycsXG4gICAgZmFjZTogJ2ltZy9iZW4ucG5nJ1xuICB9LCB7XG4gICAgaWQ6IDEsXG4gICAgbmFtZTogJ01heCBMeW54JyxcbiAgICBsYXN0VGV4dDogJ0hleSwgaXRcXCdzIG1lJyxcbiAgICBmYWNlOiAnaW1nL21heC5wbmcnXG4gIH0sIHtcbiAgICBpZDogMixcbiAgICBuYW1lOiAnQWRhbSBCcmFkbGV5c29uJyxcbiAgICBsYXN0VGV4dDogJ0kgc2hvdWxkIGJ1eSBhIGJvYXQnLFxuICAgIGZhY2U6ICdpbWcvYWRhbS5qcGcnXG4gIH0sIHtcbiAgICBpZDogMyxcbiAgICBuYW1lOiAnUGVycnkgR292ZXJub3InLFxuICAgIGxhc3RUZXh0OiAnTG9vayBhdCBteSBtdWtsdWtzIScsXG4gICAgZmFjZTogJ2ltZy9wZXJyeS5wbmcnXG4gIH0sIHtcbiAgICBpZDogNCxcbiAgICBuYW1lOiAnTWlrZSBIYXJyaW5ndG9uJyxcbiAgICBsYXN0VGV4dDogJ1RoaXMgaXMgd2lja2VkIGdvb2QgaWNlIGNyZWFtLicsXG4gICAgZmFjZTogJ2ltZy9taWtlLnBuZydcbiAgfV07XG5cbiAgcmV0dXJuIHtcbiAgICBhbGw6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGNoYXRzO1xuICAgIH0sXG4gICAgcmVtb3ZlOiBmdW5jdGlvbihjaGF0KSB7XG4gICAgICBjaGF0cy5zcGxpY2UoY2hhdHMuaW5kZXhPZihjaGF0KSwgMSk7XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uKGNoYXRJZCkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGF0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoY2hhdHNbaV0uaWQgPT09IHBhcnNlSW50KGNoYXRJZCkpIHtcbiAgICAgICAgICByZXR1cm4gY2hhdHNbaV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfTtcbn0pXG5cbmFwcC5zZXJ2aWNlKCdQdHJTZXJ2aWNlJywgWyckdGltZW91dCcsICckaW9uaWNTY3JvbGxEZWxlZ2F0ZScsIGZ1bmN0aW9uKCR0aW1lb3V0LCAkaW9uaWNTY3JvbGxEZWxlZ2F0ZSkge1xuXG4gIC8qKlxuICAgKiBUcmlnZ2VyIHRoZSBwdWxsLXRvLXJlZnJlc2ggb24gYSBzcGVjaWZpYyBzY3JvbGwgdmlldyBkZWxlZ2F0ZSBoYW5kbGUuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBkZWxlZ2F0ZUhhbmRsZSAtIFRoZSBgZGVsZWdhdGUtaGFuZGxlYCBhc3NpZ25lZCB0byB0aGUgYGlvbi1jb250ZW50YCBpbiB0aGUgdmlldy5cbiAgICovXG4gIHRoaXMudHJpZ2dlclB0ciA9IGZ1bmN0aW9uKGRlbGVnYXRlSGFuZGxlKSB7XG5cbiAgICAkdGltZW91dChmdW5jdGlvbigpIHtcblxuICAgICAgdmFyIHNjcm9sbFZpZXcgPSAkaW9uaWNTY3JvbGxEZWxlZ2F0ZS4kZ2V0QnlIYW5kbGUoZGVsZWdhdGVIYW5kbGUpLmdldFNjcm9sbFZpZXcoKTtcblxuICAgICAgaWYgKCFzY3JvbGxWaWV3KSByZXR1cm47XG5cbiAgICAgIHNjcm9sbFZpZXcuX19wdWJsaXNoKFxuICAgICAgICBzY3JvbGxWaWV3Ll9fc2Nyb2xsTGVmdCwgLXNjcm9sbFZpZXcuX19yZWZyZXNoSGVpZ2h0LFxuICAgICAgICBzY3JvbGxWaWV3Ll9fem9vbUxldmVsLCB0cnVlKTtcblxuICAgICAgdmFyIGQgPSBuZXcgRGF0ZSgpO1xuXG4gICAgICBzY3JvbGxWaWV3LnJlZnJlc2hTdGFydFRpbWUgPSBkLmdldFRpbWUoKTtcblxuICAgICAgc2Nyb2xsVmlldy5fX3JlZnJlc2hBY3RpdmUgPSB0cnVlO1xuICAgICAgc2Nyb2xsVmlldy5fX3JlZnJlc2hIaWRkZW4gPSBmYWxzZTtcbiAgICAgIGlmIChzY3JvbGxWaWV3Ll9fcmVmcmVzaFNob3cpIHtcbiAgICAgICAgc2Nyb2xsVmlldy5fX3JlZnJlc2hTaG93KCk7XG4gICAgICB9XG4gICAgICBpZiAoc2Nyb2xsVmlldy5fX3JlZnJlc2hBY3RpdmF0ZSkge1xuICAgICAgICBzY3JvbGxWaWV3Ll9fcmVmcmVzaEFjdGl2YXRlKCk7XG4gICAgICB9XG4gICAgICBpZiAoc2Nyb2xsVmlldy5fX3JlZnJlc2hTdGFydCkge1xuICAgICAgICBzY3JvbGxWaWV3Ll9fcmVmcmVzaFN0YXJ0KCk7XG4gICAgICB9XG5cbiAgICB9KTtcblxuICB9XG59XSlcbiIsImFwcC5jb25maWcoZnVuY3Rpb24oJHN0YXRlUHJvdmlkZXIsICR1cmxSb3V0ZXJQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyXG4gICAgICAuc3RhdGUoJ21lbnUudGFiLmxvZ2luJywge1xuICAgICAgICB1cmw6ICcvbG9naW4nLFxuICAgICAgICB2aWV3czoge1xuICAgICAgICAgICd0YWItbG9naW4nOiB7XG4gICAgICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL3N0YXRlcy9sb2dpbi9sb2dpbi5odG1sJyxcbiAgICAgICAgICAgIGNvbnRyb2xsZXI6ICdMb2dpbkN0cmwnXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KVxuICB9KVxuICAuY29udHJvbGxlcignTG9naW5DdHJsJywgZnVuY3Rpb24oJHNjb3BlLCAkaHR0cCwgJHJvb3RTY29wZSwgJHN0YXRlLCBLZXlTZXJ2aWNlKSB7XG4gICAgLy8gTG9hZCB0aGUgU0RLIGFzeW5jaHJvbm91c2x5XG5cbiAgfSlcbiIsImFwcC5jb25maWcoZnVuY3Rpb24oJHN0YXRlUHJvdmlkZXIsICR1cmxSb3V0ZXJQcm92aWRlcikge1xuICAkc3RhdGVQcm92aWRlclxuICAuc3RhdGUoJ21lbnUudGFiLnB1YmxpYycsIHtcbiAgICB1cmw6ICcvcHVibGljJyxcbiAgICB2aWV3czoge1xuICAgICAgJ3RhYi1wdWJsaWMnOiB7XG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvc3RhdGVzL3B1YmxpYy9wdWJsaWMuaHRtbCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdQdWJsaWNDdHJsJ1xuICAgICAgfVxuICAgIH1cbiAgfSlcbn0pXG4uY29udHJvbGxlcignUHVibGljQ3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgJGh0dHAsICRyb290U2NvcGUsICRzdGF0ZSwgQXV0aFNlcnZpY2UsIFB0clNlcnZpY2UsICR3aW5kb3csICRpb25pY1B1c2gsICRpb25pY01vZGFsLCAkY29yZG92YVBpbkRpYWxvZywgJGlvbmljUGxhdGZvcm0sICRsb2NhdGlvbikge1xuXG4gIChmdW5jdGlvbihkLCBzLCBpZCkge1xuICAgIHZhciBqcywgZmpzID0gZC5nZXRFbGVtZW50c0J5VGFnTmFtZShzKVswXTtcbiAgICBpZiAoZC5nZXRFbGVtZW50QnlJZChpZCkpIHJldHVybjtcbiAgICBqcyA9IGQuY3JlYXRlRWxlbWVudChzKTtcbiAgICBqcy5pZCA9IGlkO1xuICAgIGpzLnNyYyA9IFwiaHR0cHM6Ly9jb25uZWN0LmZhY2Vib29rLm5ldC9lbl9VUy9zZGsuanNcIjtcbiAgICBmanMucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoanMsIGZqcyk7XG4gIH0oZG9jdW1lbnQsICdzY3JpcHQnLCAnZmFjZWJvb2stanNzZGsnKSk7XG5cbiAgZnVuY3Rpb24gcmVnaXN0ZXJQdXNoKCkge1xuICAgICRpb25pY1B1c2gucmVnaXN0ZXIoKS50aGVuKGZ1bmN0aW9uKHQpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IodCk7XG4gICAgICAkaHR0cC5wdXQoJy9hcGkvdXNlcnMvdXBkYXRlJywge1xuICAgICAgICBwdXNoVG9rZW46IHQudG9rZW5cbiAgICAgIH0pLnRoZW4oZnVuY3Rpb24ocmVzKSB7XG4gICAgICAgIEF1dGhTZXJ2aWNlLnJlZnJlc2hTZXNzaW9uKCk7XG4gICAgICB9KS50aGVuKG51bGwsIGNvbnNvbGUuZXJyb3IpO1xuICAgIH0pLnRoZW4obnVsbCwgY29uc29sZS5lcnJvcik7XG4gIH1cblxuICAkc2NvcGUuJG9uKCd1c2VyIGxvYWRlZCcsIGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgaWYgKCRyb290U2NvcGUudXNlciAmJiAkcm9vdFNjb3BlLnVzZXIuZmFjZWJvb2suaWQgJiYgISRyb290U2NvcGUudXNlci5wdXNoVG9rZW4pIHJlZ2lzdGVyUHVzaCgpO1xuICB9KVxuICBpZiAoJHJvb3RTY29wZS51c2VyICYmICRyb290U2NvcGUudXNlci5mYWNlYm9vay5pZCAmJiAhJHJvb3RTY29wZS51c2VyLnB1c2hUb2tlbikgcmVnaXN0ZXJQdXNoKCk7XG5cbiAgJHNjb3BlLmdldFRyYW5zYWN0aW9ucyA9IGZ1bmN0aW9uKCkge1xuICAgICRodHRwLmdldCgnL2FwaS90cmFuc2FjdGlvbnMvcHVibGljJykudGhlbihmdW5jdGlvbihyZXMpIHtcbiAgICAgICRzY29wZS50cmFuc2FjdGlvbnMgPSByZXMuZGF0YS5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGIuZGF0ZSAtIGEuZGF0ZTtcbiAgICAgIH0pO1xuICAgICAgJHNjb3BlLiRicm9hZGNhc3QoJ3Njcm9sbC5yZWZyZXNoQ29tcGxldGUnKTtcblxuICAgIH0pLnRoZW4obnVsbCwgJHJvb3RTY29wZS5lcnIpO1xuICB9XG5cbiAgJHJvb3RTY29wZS4kb24oJ2dldFRyYW5zYWN0aW9ucycsIGZ1bmN0aW9uKCkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ2hlbGxvJyk7XG4gICAgJHNjb3BlLmdldFRyYW5zYWN0aW9ucygpO1xuICB9KTtcblxuICAkc2NvcGUuZmJMb2dpbiA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBsb2dpbldpbmRvdyA9ICR3aW5kb3cub3BlbihlbmNvZGVVUkkocm9vdFVybCArIFwiL2F1dGgvZmFjZWJvb2tcIiksICdfYmxhbmsnLCAnbG9jYXRpb249bm8sdG9vbGJhcj1ubycpO1xuICAgIGxvZ2luV2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRzdGFydCcsIGZ1bmN0aW9uKGUpIHtcbiAgICAgIGlmIChlLnVybC5pbmNsdWRlcyhcIm1lbnUvdGFiL3B1YmxpY1wiKSkge1xuICAgICAgICBsb2dpbldpbmRvdy5jbG9zZSgpO1xuICAgICAgICAkd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpO1xuICAgICAgICAgIC8vIEF1dGhTZXJ2aWNlLnJlZnJlc2hTZXNzaW9uKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIGNvbnNvbGUuZXJyb3IobG9naW5XaW5kb3cpO1xuICB9XG5cbiAgJHNjb3BlLiRvbihcIiRpb25pY1ZpZXcubG9hZGVkXCIsIGZ1bmN0aW9uKCkge1xuICAgIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpLnRoZW4oZnVuY3Rpb24odXNlcikge1xuICAgICAgaWYgKHVzZXIgJiYgdXNlci5mYWNlYm9vay5pZCkge1xuICAgICAgICBQdHJTZXJ2aWNlLnRyaWdnZXJQdHIoJ3AtcmVmcmVzaGVyJyk7XG4gICAgICB9XG4gICAgfSlcbiAgfSk7XG5cbiAgJHNjb3BlLm9wZW5NYXBDYWxsID0gZnVuY3Rpb24odHJhbnMpIHtcbiAgICBvcGVuTWFwKHRyYW5zLCAkc2NvcGUsICRpb25pY01vZGFsLCAkaHR0cCwgXCJwdWJsaWNcIik7XG4gIH1cblxuICAkc2NvcGUuY3JlYXRlQ29tbWVudCA9IGZ1bmN0aW9uKHRyYW5zKSB7XG4gICAgdmFyIG5ld0NvbW1lbnQgPSB7XG4gICAgICBuYW1lOiAkcm9vdFNjb3BlLnVzZXIuZmFjZWJvb2submFtZSxcbiAgICAgIHRleHQ6IHRyYW5zLm5ld0NvbW1lbnRcbiAgICB9XG4gICAgdHJhbnMuY29tbWVudHMucHVzaChuZXdDb21tZW50KTtcbiAgICB0cmFucy5wdXJwb3NlID0gXCJjb21tZW50XCI7XG4gICAgJGh0dHAucHV0KCcvYXBpL3RyYW5zYWN0aW9ucy91cGRhdGUnLCB0cmFucylcbiAgICAudGhlbihmdW5jdGlvbihyZXMpIHt9KS50aGVuKG51bGwsIGNvbnNvbGUuZXJyb3IpO1xuICB9XG5cbiAgJHNjb3BlLmxpa2UgPSBmdW5jdGlvbih0cmFucykge1xuICAgIHRyYW5zLmxpa2VzLnB1c2goJHJvb3RTY29wZS51c2VyLmZhY2Vib29rLmlkKTtcbiAgICB0cmFucy5wdXJwb3NlID0gXCJsaWtlXCI7XG4gICAgJGh0dHAucHV0KCcvYXBpL3RyYW5zYWN0aW9ucy91cGRhdGUnLCB0cmFucylcbiAgICAudGhlbihmdW5jdGlvbihyZXMpIHt9KS50aGVuKG51bGwsIGNvbnNvbGUuZXJyb3IpO1xuICB9XG5cbn0pOyIsImFwcC5jb25maWcoZnVuY3Rpb24oJHN0YXRlUHJvdmlkZXIpIHtcbiAgJHN0YXRlUHJvdmlkZXJcbiAgLnN0YXRlKCdtZW51Jywge1xuICAgIHVybDogJy9tZW51JyxcbiAgICBhYnN0cmFjdDogdHJ1ZSxcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL3N0YXRlcy9tZW51L21lbnUuaHRtbCcsXG4gICAgY29udHJvbGxlcjogJ01lbnVDdHJsJ1xuICB9KVxufSlcbi5jb250cm9sbGVyKCdNZW51Q3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgJGh0dHAsICRyb290U2NvcGUsICRzdGF0ZSwgS2V5U2VydmljZSwgJGlvbmljTW9kYWwsIFNlc3Npb24sIEF1dGhTZXJ2aWNlKSB7XG5cblxuICAkaW9uaWNNb2RhbC5mcm9tVGVtcGxhdGVVcmwoJy9tb2RhbHMvdW5saW5rTW9kYWwuaHRtbCcsIHtcbiAgICBzY29wZTogJHNjb3BlLFxuICAgIGFuaW1hdGlvbjogJ3NsaWRlLWluLXVwJ1xuICB9KS50aGVuKGZ1bmN0aW9uKG1vZGFsKSB7XG4gICAgJHNjb3BlLm1vZGFsID0gbW9kYWw7XG4gIH0pO1xuXG4gICRzY29wZS5sb2dvdXQgPSBmdW5jdGlvbigpIHtcbiAgICBBdXRoU2VydmljZS5sb2dvdXQoKTtcbiAgfVxuXG4gICRzY29wZS5vcGVuTW9kYWwgPSBmdW5jdGlvbigpIHtcbiAgICAkc2NvcGUubW9kYWwuc2hvdygpO1xuICB9O1xuICAkc2NvcGUuY2xvc2VNb2RhbCA9IGZ1bmN0aW9uKCkge1xuICAgICRzY29wZS5tb2RhbC5oaWRlKCk7XG4gIH07XG4gICAgLy8gQ2xlYW51cCB0aGUgbW9kYWwgd2hlbiB3ZSdyZSBkb25lIHdpdGggaXQhXG4gICAgJHNjb3BlLiRvbignJGRlc3Ryb3knLCBmdW5jdGlvbigpIHtcbiAgICAgICRzY29wZS5tb2RhbC5yZW1vdmUoKTtcbiAgICB9KTtcblxuICAgICRzY29wZS51bmxpbmtCYW5rID0gZnVuY3Rpb24oKSB7XG4gICAgICAkaHR0cC5wb3N0KCcvYXBpL3VzZXJzL3VubGlua0JhbmsnLCB7fSlcbiAgICAgIC50aGVuKGZ1bmN0aW9uKHJlcykge1xuICAgICAgICBjb25zb2xlLmxvZyhyZXMuZGF0YSk7XG4gICAgICAgIEF1dGhTZXJ2aWNlLnJlZnJlc2hTZXNzaW9uKCkudGhlbihmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgICAgJHJvb3RTY29wZS51c2VyID0gdXNlcjtcbiAgICAgICAgfSk7XG4gICAgICAgICRzY29wZS5vcGVuTW9kYWwoKTtcbiAgICAgIH0pLnRoZW4obnVsbCwgJHJvb3RTY29wZS5lcnIpO1xuICAgIH1cbiAgfSkiLCJhcHAuY29uZmlnKGZ1bmN0aW9uKCRzdGF0ZVByb3ZpZGVyLCAkdXJsUm91dGVyUHJvdmlkZXIpIHtcbiAgJHN0YXRlUHJvdmlkZXJcbiAgLnN0YXRlKCdtZW51LnRhYi5wZXJzb25hbCcsIHtcbiAgICB1cmw6ICcvcGVyc29uYWwnLFxuICAgIHZpZXdzOiB7XG4gICAgICAndGFiLXBlcnNvbmFsJzoge1xuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL3N0YXRlcy9wZXJzb25hbC9wZXJzb25hbC5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogJ1BlcnNvbmFsQ3RybCdcbiAgICAgIH1cbiAgICB9XG4gIH0pXG59KVxuLmNvbnRyb2xsZXIoJ1BlcnNvbmFsQ3RybCcsIGZ1bmN0aW9uKEtleVNlcnZpY2UsICRzY29wZSwgJGh0dHAsICRyb290U2NvcGUsICRzdGF0ZSwgQXV0aFNlcnZpY2UsIFB0clNlcnZpY2UsICRpb25pY01vZGFsKSB7XG5cbiAgZnVuY3Rpb24gc3RhcnRSZWZyZXNoaW5nKCkge1xuICAgIGlmICgkc2NvcGUudHJhbnNhY3Rpb25zLmxlbmd0aCA9PSAwKSB7XG4gICAgICBQdHJTZXJ2aWNlLnRyaWdnZXJQdHIoJ3QtcmVmcmVzaGVyJyk7XG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICBzdGFydFJlZnJlc2hpbmcoKTtcbiAgICAgIH0sIDMwMDApO1xuICAgIH1cbiAgfVxuXG4gIChmdW5jdGlvbigkKSB7XG4gICAgJChkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKSB7XG4gICAgICBLZXlTZXJ2aWNlLmdldEtleXMoKS50aGVuKGZ1bmN0aW9uKGtleXMpIHtcbiAgICAgICAgJHNjb3BlLmhhbmRsZXIgPSBQbGFpZC5jcmVhdGUoe1xuICAgICAgICAgIGNsaWVudE5hbWU6ICdDaGlsbCcsXG4gICAgICAgICAgZW52OiBrZXlzLnBsYWlkRW52LFxuICAgICAgICAgIHByb2R1Y3Q6IFsndHJhbnNhY3Rpb25zJ10sXG4gICAgICAgICAga2V5OiBrZXlzLnBsYWlkUHVibGljS2V5LFxuICAgICAgICAgIGZvcmNlSWZyYW1lOiB0cnVlLFxuICAgICAgICAgIG9uU3VjY2VzczogZnVuY3Rpb24ocHVibGljX3Rva2VuKSB7XG4gICAgICAgICAgICBQdHJTZXJ2aWNlLnRyaWdnZXJQdHIoJ3QtcmVmcmVzaGVyJyk7XG4gICAgICAgICAgICAkaHR0cC5wb3N0KCcvYXBpL3VzZXJzL2FkZEJhbmsnLCB7XG4gICAgICAgICAgICAgIHB1YmxpY190b2tlbjogcHVibGljX3Rva2VuLFxuICAgICAgICAgICAgICBsYXN0TG9jYXRpb246ICRyb290U2NvcGUubGFzdExvY2F0aW9uXG4gICAgICAgICAgICB9KS50aGVuKGZ1bmN0aW9uKHJlcykge1xuICAgICAgICAgICAgICBBdXRoU2VydmljZS5yZWZyZXNoU2Vzc2lvbigpLnRoZW4oZnVuY3Rpb24odXNlcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHVzZXIpO1xuICAgICAgICAgICAgICAgIHN0YXJ0UmVmcmVzaGluZygpO1xuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSkudGhlbihudWxsLCAkcm9vdFNjb3BlLmVycik7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBvbkV4aXQ6IGZ1bmN0aW9uKGVycm9yKSB7fVxuICAgICAgICB9KTtcbiAgICAgIH0pLnRoZW4obnVsbCwgY29uc29sZS5sb2cpO1xuICAgIH0pO1xuICB9KShqUXVlcnkpO1xuXG4gICRzY29wZS5iYW5rTG9naW4gPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoISRyb290U2NvcGUubGFzdExvY2F0aW9uICYmICEkcm9vdFNjb3BlLnVzZXIubG9jYXRpb25zLmxlbmd0aCkge1xuICAgICAgbmF2aWdhdG9yLm5vdGlmaWNhdGlvbi5jb25maXJtKFwiWW91IG5lZWQgdG8gZ28gdG8gc2V0dGluZ3MgdG8gZW5hYmxlIGxvY2F0aW9uIHNlcnZpY2VzIHNvIHdlIGNhbiBhY2N1cmF0ZWx5IGxvY2F0ZSB5b3VyIHRyYW5zYWN0aW9ucy4gVGhlIGxvY2F0aW9uIGRhdGEgaXMgbmV2ZXIgc3RvcmVkIGZvciBtb3JlIHRoYW4gNiBob3Vycy5cIiwgZnVuY3Rpb24oYnV0dG9uSW5kZXgpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcih3aW5kb3cuY29yZG92YS5wbHVnaW5zLnNldHRpbmdzKTtcbiAgICAgICAgY29uc29sZS5lcnJvcihidXR0b25JbmRleCk7XG4gICAgICAgIGlmIChidXR0b25JbmRleCA9PSAxKSB3aW5kb3cuY29yZG92YS5wbHVnaW5zLnNldHRpbmdzLm9wZW4oXCJsb2NhdGlvblwiLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdvaycpXG4gICAgICAgIH0sIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ2Vycm9yJylcbiAgICAgICAgfSk7XG5cbiAgICAgIH0sIFwiTm8gTG9jYXRpb25cIiwgW1wiU2V0dGluZ3NcIiwgXCJDbG9zZVwiXSk7XG4gICAgICBjb25zb2xlLmVycm9yKCdubyBsb2NhdGlvbicpO1xuICAgIH0gZWxzZSB7XG4gICAgICAkc2NvcGUuaGFuZGxlci5vcGVuKCk7XG4gICAgfVxuICB9XG5cbiAgJHNjb3BlLmdldFRyYW5zYWN0aW9ucyA9IGZ1bmN0aW9uKCkge1xuICAgICRodHRwLmdldCgnL2FwaS90cmFuc2FjdGlvbnMvcmVjZW50JykudGhlbihmdW5jdGlvbihyZXMpIHtcbiAgICAgICRzY29wZS50cmFuc2FjdGlvbnMgPSByZXMuZGF0YTtcbiAgICAgICRzY29wZS4kYnJvYWRjYXN0KCdzY3JvbGwucmVmcmVzaENvbXBsZXRlJyk7XG4gICAgfSkudGhlbihudWxsLCAkcm9vdFNjb3BlLmVycik7XG4gIH1cblxuICAkcm9vdFNjb3BlLiRvbigncmVzdW1lJywgZnVuY3Rpb24oKSB7XG4gICAgY29uc29sZS5lcnJvcigncmVzdW1lZCcpO1xuICAgICRzY29wZS5nZXRUcmFuc2FjdGlvbnMoKTtcbiAgfSk7XG5cbiAgJHNjb3BlLiRvbihcIiRpb25pY1ZpZXcubG9hZGVkXCIsIGZ1bmN0aW9uKCkge1xuICAgIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpLnRoZW4oZnVuY3Rpb24odXNlcikge1xuICAgICAgaWYgKCEhdXNlciAmJiAhIXVzZXIuYmFuay5pdGVtKSB7XG4gICAgICAgIFB0clNlcnZpY2UudHJpZ2dlclB0cigndC1yZWZyZXNoZXInKTtcbiAgICAgIH1cbiAgICB9KVxuICB9KTtcblxuICAkaW9uaWNNb2RhbC5mcm9tVGVtcGxhdGVVcmwoJy9tb2RhbHMvY3JlYXRlUG9zdC5odG1sJywge1xuICAgIHNjb3BlOiAkc2NvcGUsXG4gICAgYW5pbWF0aW9uOiAnc2xpZGUtaW4tdXAnXG4gIH0pLnRoZW4oZnVuY3Rpb24obW9kYWwpIHtcbiAgICAkc2NvcGUubW9kYWwgPSBtb2RhbDtcbiAgfSk7XG5cbiAgJHNjb3BlLm9wZW5Nb2RhbCA9IGZ1bmN0aW9uKCkge1xuICAgICRzY29wZS5tb2RhbC5zaG93KCk7XG4gIH07XG4gICRzY29wZS5jbG9zZU1vZGFsID0gZnVuY3Rpb24oKSB7XG4gICAgJHNjb3BlLm1vZGFsLmhpZGUoKTtcbiAgfTtcblxuICAkc2NvcGUuJG9uKCckZGVzdHJveScsIGZ1bmN0aW9uKCkge1xuICAgICRzY29wZS5tb2RhbC5yZW1vdmUoKTtcbiAgfSk7XG5cbiAgJHNjb3BlLm5ld1Bvc3QgPSBmdW5jdGlvbih0cmFuKSB7XG4gICAgJHNjb3BlLm5ld1RyYW5zYWN0aW9uID0gdHJhbjtcbiAgICBpZiAodHJhbi5jYXRlZ29yeSkgJHNjb3BlLm5ld1RyYW5zYWN0aW9uLmNhcHRpb24gPSB0cmFuLmNhdGVnb3J5W3RyYW4uY2F0ZWdvcnkubGVuZ3RoIC0gMV07XG4gICAgJHNjb3BlLm9wZW5Nb2RhbCgpO1xuICB9XG5cbiAgJHNjb3BlLnN1Ym1pdFRyYW5zYWN0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgJGh0dHAucG9zdCgnL2FwaS90cmFuc2FjdGlvbnMvcG9zdCcsICRzY29wZS5uZXdUcmFuc2FjdGlvbilcbiAgICAudGhlbihmdW5jdGlvbihyZXMpIHtcbiAgICAgICRzY29wZS5jbG9zZU1vZGFsKCk7XG4gICAgICBBdXRoU2VydmljZS5yZWZyZXNoU2Vzc2lvbigpLnRoZW4oZnVuY3Rpb24odXNlcikge1xuICAgICAgICBQdHJTZXJ2aWNlLnRyaWdnZXJQdHIoJ3QtcmVmcmVzaGVyJyk7XG4gICAgICB9KVxuICAgIH0pLnRoZW4obnVsbCwgJHJvb3RTY29wZS5lcnIpO1xuICB9XG5cbiAgJHNjb3BlLmRlbGV0ZVBvc3QgPSBmdW5jdGlvbih0cmFuKSB7XG4gICAgJGh0dHAucG9zdCgnL2FwaS90cmFuc2FjdGlvbnMvZGVsZXRlJywgdHJhbilcbiAgICAudGhlbihmdW5jdGlvbihyZXMpIHtcbiAgICAgIFB0clNlcnZpY2UudHJpZ2dlclB0cigndC1yZWZyZXNoZXInKTtcbiAgICB9KS50aGVuKG51bGwsICRyb290U2NvcGUuZXJyKTtcbiAgfVxuXG5cbiAgJHNjb3BlLm9wZW5NYXBDYWxsID0gZnVuY3Rpb24odHJhbnMpIHtcbiAgICBvcGVuTWFwKHRyYW5zLCAkc2NvcGUsICRpb25pY01vZGFsLCAkaHR0cCwgXCJwZXJzb25hbFwiKTtcbiAgfVxuXG59KTsiLCJhcHAuY29uZmlnKGZ1bmN0aW9uKCRzdGF0ZVByb3ZpZGVyLCAkdXJsUm91dGVyUHJvdmlkZXIpIHtcbiAgJHN0YXRlUHJvdmlkZXJcbiAgICAuc3RhdGUoJ21lbnUudGFiJywge1xuICAgICAgdXJsOiAnL3RhYicsXG4gICAgICBhYnN0cmFjdDogdHJ1ZSxcbiAgICAgIHRlbXBsYXRlVXJsOiAnanMvc3RhdGVzL3RhYnMvdGFicy5odG1sJyxcbiAgICB9KVxuXG4gIC8vIGlmIG5vbmUgb2YgdGhlIGFib3ZlIHN0YXRlcyBhcmUgbWF0Y2hlZCwgdXNlIHRoaXMgYXMgdGhlIGZhbGxiYWNrXG59KVxuIl19
