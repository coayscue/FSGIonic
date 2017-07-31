// Ionic Starter App
// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.services' is found in services.js
// 'starter.controllers' is found in controllers.js

window.app = angular.module('starter', ['ionic', 'ionic.cloud', 'ngCordova', 'ngCordova.plugins.nativeStorage', 'ngCordova.plugins.pinDialog'])
.controller('AppController', function($rootScope) {})
.run(function($cordovaNativeStorage) {
  window.storage = $cordovaNativeStorage;
})
.config(function($ionicCloudProvider) {
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
})
.config(function($urlRouterProvider, $httpProvider) {
    //comment out for dev
    $httpProvider.interceptors.push(function() {
      return {
        request: function(config) {
          config.url = rootUrl + (config.url.charAt(0) == '/' ? '' : '/') + config.url;
          return config;
        },
        response: function(res) {
          return res;
        }
      };
    });

    $urlRouterProvider.otherwise('/menu/tab/public');
  })
.run(function($ionicPlatform, $http, $rootScope, AuthService, KeyService, $cordovaNativeStorage, $cordovaPinDialog) {
  $ionicPlatform.ready(function() {
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
      AuthService.getLoggedInUser().then(function(user) {
        $rootScope.user = user;
      });

      KeyService.getKeys();

      $ionicPlatform.on('resume', function() {
        $rootScope.$broadcast('resume');
        AuthService.refreshSession();
        $rootScope.$on('user loaded', function(event, data) {
          if ($rootScope.user && $rootScope.user.loginPin && window.cordova && $rootScope.blackout) enterPin();
        })
        if ($rootScope.user && $rootScope.user.loginPin && window.cordova && $rootScope.blackout) enterPin();
      })
      $ionicPlatform.on('pause', function(event, data) {
        if ($rootScope.user && $rootScope.user.loginPin) $rootScope.blackout = true;
        if (!$rootScope.$$phase) $rootScope.$apply();
      })
    });



  document.addEventListener('deviceready', function() {

    var bgGeo = window.BackgroundGeolocation;

    window.locCallback = function(location, taskID) {
      console.error('[js] BackgroundGeolocation callback:  ' + location.coords.latitude + ',' + location.coords.longitude);
      if (location.coords.longitude) {
        $http.post('/api/users/location', location.coords)
        .then(function(res) {
          bgGeo.finish(taskID);
        })
        .then(null, function(err) {
          console.error(err);
          $rootScope.lastLocation = location.coords;
          bgGeo.finish(taskID);
        })
      } else {
        bgGeo.finish(taskID);
      }
    };

    window.locFailure = function(error) {
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
    }, function(state) {
      if (!state.enabled) {
        bgGeo.start();
      }
    });

    bgGeo.on('location', window.locCallback, window.locFailure);

  }, true);

  var outstandingPin = false;

  function enterPin() {
    function checkPin() {
      $cordovaPinDialog.prompt("Enter your pin", "Enter Pin").then(function(results) {
        if (results.buttonIndex == 1 && results.input1 != $rootScope.user.loginPin) checkPin();
        else if (results.buttonIndex == 2) checkPin();
        else {
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
})


app.run(function($rootScope) {
  $rootScope.checkRange = function(property, min, max) {
    if (property < min) return min;
    if (property > max) return max;
    return property;
  }

  $rootScope.err = function(err) {
    console.log(err);
    if (err.message) $.Zebra_Dialog(err.message);
    else if (err.data) $.Zebra_Dialog(err.data);
    else $.Zebra_Dialog(err.statusText);
  }

});

document.addEventListener("deviceready", onDeviceReady, false);

function onDeviceReady() {
  window.open = cordova.InAppBrowser.open;
}