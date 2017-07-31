//map stuff
function openMap(trans, $scope, $ionicModal, $http, type) {
  $scope.selectedTrans = trans;

  $ionicModal.fromTemplateUrl('/modals/map.html', {
    scope: $scope,
    animation: 'slide-in-up'
  }).then(function(modal) {
    $scope.mapModal = modal;
    $scope.openMap();
  });

  $scope.closeMap = function() {
    $scope.map.remove();
    var popup = document.getElementById('map-poppup');
    popup.parentNode.removeChild(popup);
    $scope.mapModal.hide();
  };

  // Cleanup the modal when we're done with it!
  $scope.$on('$destroy', function() {
    $scope.modal.remove();
  });

  //open
  $scope.openMap = function() {
    $scope.mapModal.show();
    new Promise(function(resolve, reject) {
      if (type == "public") {
        $http.get("/api/transactions/forUser?" + jQuery.param({
          uid: trans.userID._id
        })).then(function(res) {
          resolve(res.data);
        }).then(null, reject);
      } else {
        resolve($scope.transactions)
      }
    })
    .then(function(data) {
      L.mapbox.accessToken = 'pk.eyJ1IjoiY29heXNjdWUiLCJhIjoiY2o0eXAzNWF6MXZ3bjMzbmtpdmdwdzFibSJ9.hFSrzFaz9h-Jupv4yHh7_Q';
      $scope.map = L.mapbox.map('map-poppup', 'mapbox.streets').setView([trans.location.lat, trans.location.lon], 15);
      var markers = new L.MarkerClusterGroup();
      var data =
      data.forEach(function(t) {
        if (t.location.lat) {
          var title = generateTitle(t);
          var marker = L.marker(new L.LatLng(t.location.lat, t.location.lon), {
            icon: L.mapbox.marker.icon({}),
            title: title
          })
          marker.bindPopup(title);
          markers.addLayer(marker);
        }
      })
      $scope.map.addLayer(markers);

      var title = generateTitle(trans);
      L.popup()
      .setLatLng([trans.location.lat + .0003, trans.location.lon])
      .setContent(title)
      .openOn($scope.map);
    }).then(null, console.error);
  }

  function generateTitle(tran) {
    return "<div style='text-align:center'><h3>" + tran.name + "</h3>" + (tran.caption ? ("<h4>" + tran.caption + "</h4>") : "") + "<h4>$" + tran.amount.toFixed(2) + "</h4><div style='height:100px; width:100%; min-width:200px; overflow:scroll; overflow-y:hidden; -webkit-overflow-scrolling: touch;'><div style='text-align:left; background-color:gray; height:100px; width:10000px;'>" + tran.photos.reduce(function(sum, p) {
      return sum + "<img style='height:100%' src='" + p + "'/>";
    }, "") + "</div></div></</div>";
  }
}