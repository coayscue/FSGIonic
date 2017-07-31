app.config(function($stateProvider, $urlRouterProvider) {
  $stateProvider
    .state('menu.tab', {
      url: '/tab',
      abstract: true,
      templateUrl: 'js/states/tabs/tabs.html',
    })

  // if none of the above states are matched, use this as the fallback
})
