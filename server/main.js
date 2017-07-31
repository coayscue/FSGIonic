'use strict';
var chalk = require('chalk');

// Requires in ./db/index.js -- which returns a promise that represents
// mongoose establishing a connection to a MongoDB database.
var startDb = require('./db');
var fs = require('fs');
var path = require('path');

// Create a node server instance! cOoL!
var options = {
  key: fs.readFileSync(path.join(__dirname, './keys/private.key')),
  cert: fs.readFileSync(path.join(__dirname, './keys/certificate.crt')),
  ca: fs.readFileSync(path.join(__dirname, './keys/ca_bundle.crt'))
};

// Create a node server instance! cOoL!
var secureServer = require('https').createServer(options);

var createApplication = function() {
  var app = require('./app');
  secureServer.on('request', app); // Attach the Express application.
  require('./io')(secureServer); // Attach socket.io.
};

var startServer = function() {

  var HTTPS_PORT = process.env.HTTPS_PORT || 1337;

  secureServer.listen(HTTPS_PORT, function() {
    console.log(chalk.blue('Secure server started on port', chalk.magenta(HTTPS_PORT)));
  });
};

var startexpress = function() {
  var app = require('./app');

  // expressApp.get('*', function(req, res) {
  //   res.redirect('https://' + req.hostname + req.url)
  // });
  var HTTP_PORT = process.env.HTTP_PORT || 8000;
  app.listen(HTTP_PORT);
};

startDb.then(createApplication).then(startServer).then(startexpress).catch(function(err) {
  console.error(chalk.red(err.stack));
  process.kill(1);
});