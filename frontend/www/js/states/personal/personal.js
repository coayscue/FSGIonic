app.config(function($stateProvider, $urlRouterProvider) {
  $stateProvider
  .state('menu.tab.personal', {
    url: '/personal',
    views: {
      'tab-personal': {
        templateUrl: 'js/states/personal/personal.html',
        controller: 'PersonalCtrl'
      }
    }
  })
})
.controller('PersonalCtrl', function(KeyService, $scope, $http, $rootScope, $state, AuthService, PtrService, $ionicModal) {

  function startRefreshing() {
    if ($scope.transactions.length == 0) {
      PtrService.triggerPtr('t-refresher');
      setTimeout(function() {
        startRefreshing();
      }, 3000);
    }
  }

  (function($) {
    $(document).ready(function() {
      KeyService.getKeys().then(function(keys) {
        $scope.handler = Plaid.create({
          clientName: 'Chill',
          env: keys.plaidEnv,
          product: ['transactions'],
          key: keys.plaidPublicKey,
          forceIframe: true,
          onSuccess: function(public_token) {
            PtrService.triggerPtr('t-refresher');
            $http.post('/api/users/addBank', {
              public_token: public_token,
              lastLocation: $rootScope.lastLocation
            }).then(function(res) {
              AuthService.refreshSession().then(function(user) {
                console.log(user);
                startRefreshing();
              })
            }).then(null, $rootScope.err);
          },
          onExit: function(error) {}
        });
      }).then(null, console.log);
    });
  })(jQuery);

  $scope.bankLogin = function() {
    if (!$rootScope.lastLocation && !$rootScope.user.locations.length) {
      navigator.notification.confirm("You need to go to settings to enable location services so we can accurately locate your transactions. The location data is never stored for more than 6 hours.", function(buttonIndex) {
        console.error(window.cordova.plugins.settings);
        console.error(buttonIndex);
        if (buttonIndex == 1) window.cordova.plugins.settings.open("location", function() {
          console.error('ok')
        }, function() {
          console.error('error')
        });

      }, "No Location", ["Settings", "Close"]);
      console.error('no location');
    } else {
      $scope.handler.open();
    }
  }

  $scope.getTransactions = function() {
    $http.get('/api/transactions/recent').then(function(res) {
      $scope.transactions = res.data;
      $scope.$broadcast('scroll.refreshComplete');
    }).then(null, $rootScope.err);
  }

  $rootScope.$on('resume', function() {
    console.error('resumed');
    $scope.getTransactions();
  });

  $scope.$on("$ionicView.loaded", function() {
    AuthService.getLoggedInUser().then(function(user) {
      if (!!user && !!user.bank.item) {
        PtrService.triggerPtr('t-refresher');
      }
    })
  });

  $ionicModal.fromTemplateUrl('/modals/createPost.html', {
    scope: $scope,
    animation: 'slide-in-up'
  }).then(function(modal) {
    $scope.modal = modal;
  });

  $scope.openModal = function() {
    $scope.modal.show();
  };
  $scope.closeModal = function() {
    $scope.modal.hide();
  };

  $scope.$on('$destroy', function() {
    $scope.modal.remove();
  });

  $scope.newPost = function(tran) {
    $scope.newTransaction = tran;
    if (tran.category) $scope.newTransaction.caption = tran.category[tran.category.length - 1];
    $scope.openModal();
  }

  $scope.submitTransaction = function() {
    $http.post('/api/transactions/post', $scope.newTransaction)
    .then(function(res) {
      $scope.closeModal();
      AuthService.refreshSession().then(function(user) {
        PtrService.triggerPtr('t-refresher');
      })
    }).then(null, $rootScope.err);
  }

  $scope.deletePost = function(tran) {
    $http.post('/api/transactions/delete', tran)
    .then(function(res) {
      PtrService.triggerPtr('t-refresher');
    }).then(null, $rootScope.err);
  }


  $scope.openMapCall = function(trans) {
    openMap(trans, $scope, $ionicModal, $http, "personal");
  }

});