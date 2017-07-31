'use strict';
var mongoose = require('mongoose');

var schema = new mongoose.Schema({
  account_id: String,
  amount: Number,
  category: Array,
  date: Date,
  location: Object,
  name: String,
  transaction_id: {
    type: String,
    unique: true
  },
  caption: String,
  userID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  userFBID: String,
  comments: Array,
  likes: Array,
  icon: String,
  address: String,
  phone: String,
  website: String,
  published: {
    type: Boolean,
    default: false
  },
  photos: Array
});
mongoose.model('PrivateTransaction', schema);