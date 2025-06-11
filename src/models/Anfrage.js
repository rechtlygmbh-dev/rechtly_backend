const mongoose = require('mongoose');

const anfrageSchema = new mongoose.Schema({
  anfrageTyp: {
    type: String,
    enum: ['bussgeld', 'verkehrsunfall', 'kfz-gutachten'],
    required: true
  },
  anrede: String,
  titel: String,
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
    match: [/^\S+@\S+\.\S+$/, 'Bitte geben Sie eine gültige E-Mail-Adresse ein']
  },
  telefon: String,
  strasse: {
    type: String,
    required: true
  },
  hausnummer: String,
  plz: {
    type: String,
    required: true,
    match: [/^[0-9]{5}$/, 'Die PLZ muss aus 5 Ziffern bestehen']
  },
  ort: {
    type: String,
    required: true
  },
  bussgeld: {
    vorwurf: String,
    fahrzeugTyp: String,
    punktestand: String,
    probezeit: String,
    schreiben: String,
    kostenuebernahme: String,
    aktenzeichen: String,
    zustellungsdatum: Date,
    behoerde: String,
    kennzeichen: String
  },
  verkehrsunfall: {
    unfallverursacher: String,
    unfallDatum: Date,
    unfallZeit: String,
    strasse: String,
    plz: String,
    weitereAngaben: String,
    unfallhergang: String,
    reaktion: {
      gebremst: Boolean,
      ausgewichen: Boolean,
      keineReaktion: Boolean
    },
    verkehrszeichen: {
      ampel: Boolean,
      verkehrsschild: Boolean,
      keine: Boolean
    },
    fahrzeugDetails: {
      markeModell: String,
      kennzeichen: String,
      farbe: String,
      erstzulassung: String,
      weitereSchaeden: String
    },
    polizei: {
      verstaendigt: String,
      polizeibericht: [String]
    },
    zeugen: {
      vorhanden: String,
      details: String
    },
    personenschaden: String,
    rettungsdienst: String
  },
  kfzGutachten: {
    fahrzeugTyp: String,
    marke: String,
    modell: String,
    baujahr: String,
    kennzeichen: String,
    schadensart: String,
    schadensbeschreibung: String,
    versicherung: {
      name: String,
      versicherungsnummer: String
    }
  },
  dokumente: [{
    id: String,
    name: String,
    path: String
  }],
  datenschutz: {
    type: Boolean,
    required: true,
    default: false
  },
  anwaltEinwilligung: {
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
  },
  aktualisiertAm: {
    type: Date,
    default: Date.now
  }
}, { collection: 'Anfragen' });

// Aktualisiere aktualisiertAm vor jedem Speichern
anfrageSchema.pre('save', function(next) {
  this.aktualisiertAm = Date.now();
  next();
});

module.exports = mongoose.model('Anfrage', anfrageSchema); 