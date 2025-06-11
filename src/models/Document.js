const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  anfrageId: {
    type: String,
    required: true,
    index: true
  },
  art: {
    type: String,
    required: true,
    enum: ['BUSSGELD', 'KFZGUTACHTEN', 'VERKEHRSUNFALL']
  },
  erstelltAm: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    required: true,
    enum: ['offen', 'in_bearbeitung', 'abgeschlossen'],
    default: 'offen'
  },
  kontakt: {
    name: String,
    email: String,
    telefon: String
  },
  dokumente: [{
    typ: {
      type: String,
      required: true,
      enum: ['BUSSGELD', 'KFZGUTACHTEN', 'VERKEHRSUNFALL']
    },
    filename: {
      type: String,
      required: true
    },
    pfad: {
      type: String,
      required: true
    },
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }]
});

module.exports = mongoose.model('Document', documentSchema, 'documents'); 