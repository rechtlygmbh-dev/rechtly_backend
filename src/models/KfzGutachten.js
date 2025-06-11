const mongoose = require('mongoose');

const kfzGutachtenSchema = new mongoose.Schema({
  schuld: {
    type: String,
    enum: ['unfallgegner', 'selbst'],
    required: true
  },
  bilder: {
    vorneRechts: [{
      id: String,
      name: String,
      path: String
    }],
    hintenLinks: [{
      id: String,
      name: String,
      path: String
    }],
    schadenBereich: [{
      id: String,
      name: String,
      path: String
    }],
    detailBilder: [{
      id: String,
      name: String,
      path: String
    }],
    kilometerstand: [{
      id: String,
      name: String,
      path: String
    }],
    fahrzeugschein: [{
      id: String,
      name: String,
      path: String
    }]
  },
  schadenBeschreibung: {
    type: String,
    required: true
  },
  vorname: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    match: [/^\S+@\S+\.\S+$/, 'Bitte geben Sie eine gültige E-Mail-Adresse ein']
  },
  telefonnummer: {
    type: String,
    required: true
  },
  strasse: {
    type: String,
    required: true
  },
  hausnummer: {
    type: String,
    required: true
  },
  plz: {
    type: String,
    required: true,
    match: [/^[0-9]{5}$/, 'Bitte geben Sie eine gültige PLZ ein']
  },
  ort: {
    type: String,
    required: true
  },
  datenschutz: {
    type: Boolean,
    required: true,
    default: false
  },
  status: {
    type: String,
    enum: ['neu', 'in_bearbeitung', 'abgeschlossen', 'abgelehnt'],
    default: 'neu'
  },
  erstelltAm: {
    type: Date,
    default: Date.now
  },
  aktualisiertAm: {
    type: Date,
    default: Date.now
  }
});

// Aktualisiere aktualisiertAm vor jedem Speichern
kfzGutachtenSchema.pre('save', function(next) {
  this.aktualisiertAm = Date.now();
  next();
});

module.exports = mongoose.model('KfzGutachten', kfzGutachtenSchema); 