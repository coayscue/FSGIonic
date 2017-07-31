app.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider
      .state('menu.tab.login', {
        url: '/login',
        views: {
          'tab-login': {
            templateUrl: 'js/states/login/login.html',
            controller: 'LoginCtrl'
          }
        }
      })
  })
  .controller('LoginCtrl', function($scope, $http, $rootScope, $state, KeyService) {
    // Load the SDK asynchronously

  })
