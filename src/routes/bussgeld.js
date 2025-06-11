const express = require('express');
const router = express.Router();
const Bussgeld = require('../models/Bussgeld');
const emailService = require('../services/emailService');

// POST /api/anfrage/bussgeld
router.post('/', async (req, res) => {
  try {
    const {
      service,
      vorname,
      name,
      email,
      telefon,
      strasse,
      hausnummer,
      plz,
      ort,
      bussgeldBeschreibung,
      dokumente,
      datenschutz
    } = req.body;

    // Erstelle neue Bussgeld-Anfrage
    const bussgeld = new Bussgeld({
      service,
      vorname,
      name,
      email,
      telefon,
      strasse,
      hausnummer,
      plz,
      ort,
      bussgeldBeschreibung,
      dokumente,
      datenschutz,
      status: 'neu'
    });

    // Speichere in der Datenbank
    await bussgeld.save();

    // Sende Bestätigungs-E-Mail an Kunden
    await emailService.sendBussgeldConfirmation({
      email,
      vorname,
      name
    });

    // Sende Benachrichtigung an Support
    await emailService.sendBussgeldNotification({
      bussgeld
    });

    res.json({
      success: true,
      message: 'Bussgeld-Anfrage erfolgreich gespeichert'
    });
  } catch (error) {
    console.error('Fehler beim Speichern der Bussgeld-Anfrage:', error);
    res.status(500).json({
      success: false,
      error: 'Interner Server-Fehler',
      details: error.message
    });
  }
});

module.exports = router; 