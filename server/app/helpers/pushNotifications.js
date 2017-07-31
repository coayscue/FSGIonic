var request = require("request");
var ionicConfig = {
  apiToken: global.env.IONIC.apiKey
}
var ionicAPI = require('ionic-api').init(ionicConfig);

module.exports = function(tokens, title, message) {
  if (tokens.length) {
    ionicAPI.notifications.create({
      title: title,
      message: message
    }, {
      tokens: tokens
    }, global.env.IONIC.pushProfile).then(function(res) {
      console.log(JSON.stringify(res, null, 2));
    })
    .then(null, console.log);
  }
}