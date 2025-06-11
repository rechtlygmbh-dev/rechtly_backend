const mongoose = require('mongoose');

const bussgeldSchema = new mongoose.Schema({
  person: {
    vorname: {
      type: String,
      required: true
    },
    nachname: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Bitte geben Sie eine gültige E-Mail-Adresse ein']
    },
    telefon: {
      type: String,
      required: false,
      default: ''
    }
  },
  adresse: {
    strasse: {
      type: String,
      required: true
    },
    hausnummer: {
      type: String,
      required: false,
      default: ''
    },
    plz: {
      type: String,
      required: true
    },
    ort: {
      type: String,
      required: true
    }
  },
  bussgeld: {
    datum: {
      type: Date,
      required: true
    },
    beschreibung: {
      type: String,
      required: true
    },
    dokumente: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Image'
    }]
  },
  datenschutz: {
    type: Boolean,
    required: true,
    default: false
  },
  status: {
    type: String,
    enum: ['neu', 'in_bearbeitung', 'abgeschlossen'],
    default: 'neu'
  },
  erstelltAm: {
    type: Date,
    default: Date.now
  }
}, { collection: 'Anfragen' });

// Aktualisiere aktualisiertAm vor jedem Speichern
bussgeldSchema.pre('save', function(next) {
  this.aktualisiertAm = Date.now();
  next();
});

module.exports = mongoose.model('Bussgeld', bussgeldSchema); 