var mongoose = require('mongoose')
var Transaction = mongoose.model('Transaction');
var PrivateTransaction = mongoose.model('PrivateTransaction');
var User = mongoose.model('User');
var queryString = require('query-string');
var googleMapsClient = require('@google/maps').createClient({
  key: global.env.GOOGLE.apiKey,
  Promise: Promise
});

function processTransactions(transactions, user, oneLocation) {
  var promArray = [];
  transactions.forEach(function(t) {
    promArray.push(new Promise(function(resolve, reject) {
      var gPromArray = [];
      if (oneLocation) var locations = [user.locations[user.locations.length - 1]];
      else var locations = user.locations;
      locations.forEach(function(loc) {
        gPromArray.push(new Promise(function(resolve1, reject1) {
          var obj = {
            rankby: "distance",
            location: [loc.latitude, loc.longitude],
            keyword: t.name
          }
          googleMapsClient.placesNearby(obj).asPromise()
          .then(function(res) {
            if (res.json.results.length != 0) {
              var obj = {
                data: res.json.results[0],
                dist: Math.sqrt(Math.pow(res.json.results[0].geometry.location.lat - loc.latitude, 2) + Math.pow(res.json.results[0].geometry.location.lng - loc.longitude, 2))
              }
              resolve1(obj);
            } else {
              resolve1({
                data: {},
                dist: 1000
              })
            }
          }).then(null, console.log);
        }));
      })
      Promise.all(gPromArray).then(function(elements) {
        var minEl = elements[0];
        if (minEl) {
          elements.forEach(function(el) {
            if (el.dist < minEl.dist) minEl = el;
          })
          if (minEl.dist != 1000) {
            googleMapsClient.place({
              placeid: minEl.data.place_id
            }).asPromise()
            .then(function(data) {
              var data = data.json.result;
              t.website = data.website;
              t.name = data.name;
              t.phone = data.international_phone_number;
              t.icon = data.icon;
              t.location = {
                lat: data.geometry.location.lat,
                lon: data.geometry.location.lng
              };
              t.address = data.formatted_address;
              if (data.photos) {
                t.photos = data.photos.map(function(p) {
                  return "https://maps.googleapis.com/maps/api/place/photo?" + queryString.stringify({
                    photoreference: p.photo_reference,
                    maxheight: 800,
                    maxwidth: 800,
                    key: global.env.GOOGLE.apiKey
                  });
                })
              }
              resolve(t);
            }).then(null, reject);
          } else {
            resolve(t);
          }
        } else {
          resolve(t);
        }
      }).then(null, console.log);
    }).then(function(tran) {
      tran.userID = user._id;
      (new PrivateTransaction(tran)).save();
      return tran;
    }))
  })
  return Promise.all(promArray)
}

module.exports = processTransactions;