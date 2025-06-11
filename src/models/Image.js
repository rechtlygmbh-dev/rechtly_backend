const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  originalname: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  anfrageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Anfrage',
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Image', imageSchema, 'Anfragen'); 