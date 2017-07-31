var router = require('express').Router();
module.exports = router;

router.get('/', function(req, res, next) {
  res.send({
    facebookAppId: global.env.FACEBOOK.appID,
    plaidBaseUrl: global.env.PLAID.baseUrl,
    plaidClientID: global.env.PLAID.clientID,
    plaidPublicKey: global.env.PLAID.publicKey,
    plaidEnv: global.env.PLAID.environment,
    env: process.env.NODE_ENV
  })
})
