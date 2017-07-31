app.config(function($stateProvider) {
  $stateProvider
  .state('menu', {
    url: '/menu',
    abstract: true,
    templateUrl: 'js/states/menu/menu.html',
    controller: 'MenuCtrl'
  })
})
.controller('MenuCtrl', function($scope, $http, $rootScope, $state, KeyService, $ionicModal, Session, AuthService) {


  $ionicModal.fromTemplateUrl('/modals/unlinkModal.html', {
    scope: $scope,
    animation: 'slide-in-up'
  }).then(function(modal) {
    $scope.modal = modal;
  });

  $scope.logout = function() {
    AuthService.logout();
  }

  $scope.openModal = function() {
    $scope.modal.show();
  };
  $scope.closeModal = function() {
    $scope.modal.hide();
  };
    // Cleanup the modal when we're done with it!
    $scope.$on('$destroy', function() {
      $scope.modal.remove();
    });

    $scope.unlinkBank = function() {
      $http.post('/api/users/unlinkBank', {})
      .then(function(res) {
        console.log(res.data);
        AuthService.refreshSession().then(function(user) {
          $rootScope.user = user;
        });
        $scope.openModal();
      }).then(null, $rootScope.err);
    }
  })