/*
    These environment variables are not hardcoded so as not to put
    production information in a repo. They should be set in your
    heroku (or whatever VPS used) configuration to be set in the
    applications environment, along with NODE_ENV=production

 */

module.exports = {
  "DATABASE_URI": process.env.MONGODB_URL,
  "ROOT_URL": process.env.ROOT_URL,
  "SESSION_SECRET": process.env.SESSION_SECRET,
  "TWITTER": {
    "consumerKey": process.env.TWITTER_CONSUMER_KEY,
    "consumerSecret": process.env.TWITTER_CONSUMER_SECRET,
    "callbackUrl": process.env.TWITTER_CALLBACK
  },
  "FACEBOOK": {
    "appID": process.env.FACEBOOK_APP_ID,
    "secret": process.env.FACEBOOK_CLIENT_SECRET,
    "callbackURL": process.env.FACEBOOK_CALLBACK_URL
  },
  "GOOGLE": {
    "clientID": process.env.GOOGLE_CLIENT_ID,
    "clientSecret": process.env.GOOGLE_CLIENT_SECRET,
    "callbackURL": process.env.GOOGLE_CALLBACK_URL,
    "apiKey": process.env.GOOGLE_API_KEY
  },
  "PLAID": {
    "baseUrl": process.env.PLAID_BASE_URL,
    "clientID": process.env.PLAID_CLIENT_ID,
    "publicKey": process.env.PLAID_PUBLIC_KEY,
    "secret": process.env.PLAID_SECRET,
    "environment": process.env.PLAID_ENV
  },
  "IONIC": {
    "apiKey": process.env.IONIC_API_KEY,
    "pushProfile": process.env.IONIC_PUSH_PROFILE
  }
};
