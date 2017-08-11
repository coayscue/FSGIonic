'use strict';
var mongoose = require('mongoose');

var schema = new mongoose.Schema({
  session: String,
  stages: Array,
  failed: Boolean,
  complete: Boolean,
  lastTimestamp: Date,
  stageStep: Number,
  faceVideo: String,
  prevFaces: Array,
  startDate: Date
});
mongoose.model('HeadTilt', schema);