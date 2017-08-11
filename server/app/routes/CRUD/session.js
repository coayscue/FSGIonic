var mongoose = require('mongoose');
var sessions = [];

var router = require('express').Router();
module.exports = router;

router.get('/newSession', function(req, res, next) {
  var newSesh = Math.floor(Math.random() * 100000000);
  sessions.push(Math.floor(Math.random() * 100000000));
  res.send({
    seshID: newSesh,
    order: ["connect the dots", "read the text", "tilt head"]
  });
})