var FB = require('fb');

// var fb = new FB.Facebook({
//   appId: "176702249535831",
//   appSecret: "4d339689425dd8586961d20d57ea735f"
// })

FB.api('/me', 'get', {
  access_token: "EAACgtbLQiVcBAAOsbuZCRXZCCimhctOawGKnbcz6hIoycnACZBgZCdUg6d4gZCvCBl3d1kpmObPNSKoUE33URDJniy9EGtePOVVhFTyyxGFVzOjOVOECA6fkmdjiObLqqERn6iTpchGzjRbfyhsFcZCLWQZB0WdopZCJ3qnaL2G4ZBwZDZD",
  fields: 'id,name,gender,email,age_range,picture.type(large),friends'
}, function(res) {
  console.log(JSON.stringify(res));
});
