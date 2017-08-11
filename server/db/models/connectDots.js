'use strict';
var mongoose = require('mongoose');

var schema = new mongoose.Schema({
  session: String,
  dots: Array,
  points: Array,
  passed: Boolean,
  type: String
});
mongoose.model('ConnectDots', schema);