app.config(function($stateProvider, $urlRouterProvider) {
  $stateProvider
  .state('menu.tab.public', {
    url: '/public',
    views: {
      'tab-public': {
        templateUrl: 'js/states/public/public.html',
        controller: 'PublicCtrl'
      }
    }
  })
})
.controller('PublicCtrl', function($scope, $http, $rootScope, $state, AuthService, PtrService, $window, $ionicPush, $ionicModal, $cordovaPinDialog, $ionicPlatform, $location) {

  (function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s);
    js.id = id;
    js.src = "https://connect.facebook.net/en_US/sdk.js";
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'facebook-jssdk'));

  function registerPush() {
    $ionicPush.register().then(function(t) {
      console.error(t);
      $http.put('/api/users/update', {
        pushToken: t.token
      }).then(function(res) {
        AuthService.refreshSession();
      }).then(null, console.error);
    }).then(null, console.error);
  }

  $scope.$on('user loaded', function(event, data) {
    if ($rootScope.user && $rootScope.user.facebook.id && !$rootScope.user.pushToken) registerPush();
  })
  if ($rootScope.user && $rootScope.user.facebook.id && !$rootScope.user.pushToken) registerPush();

  $scope.getTransactions = function() {
    $http.get('/api/transactions/public').then(function(res) {
      $scope.transactions = res.data.sort(function(a, b) {
        return b.date - a.date;
      });
      $scope.$broadcast('scroll.refreshComplete');

    }).then(null, $rootScope.err);
  }

  $rootScope.$on('getTransactions', function() {
    console.error('hello');
    $scope.getTransactions();
  });

  $scope.fbLogin = function() {
    var loginWindow = $window.open(encodeURI(rootUrl + "/auth/facebook"), '_blank', 'location=no,toolbar=no');
    loginWindow.addEventListener('loadstart', function(e) {
      if (e.url.includes("menu/tab/public")) {
        loginWindow.close();
        $window.location.reload();
          // AuthService.refreshSession();
        }
      });
    console.error(loginWindow);
  }

  $scope.$on("$ionicView.loaded", function() {
    AuthService.getLoggedInUser().then(function(user) {
      if (user && user.facebook.id) {
        PtrService.triggerPtr('p-refresher');
      }
    })
  });

  $scope.openMapCall = function(trans) {
    openMap(trans, $scope, $ionicModal, $http, "public");
  }

  $scope.createComment = function(trans) {
    var newComment = {
      name: $rootScope.user.facebook.name,
      text: trans.newComment
    }
    trans.comments.push(newComment);
    trans.purpose = "comment";
    $http.put('/api/transactions/update', trans)
    .then(function(res) {}).then(null, console.error);
  }

  $scope.like = function(trans) {
    trans.likes.push($rootScope.user.facebook.id);
    trans.purpose = "like";
    $http.put('/api/transactions/update', trans)
    .then(function(res) {}).then(null, console.error);
  }

});