const express = require('express');
const router = express.Router();
const KfzGutachten = require('../models/KfzGutachten');
const emailService = require('../services/emailService');

// POST /api/anfrage/kfz-gutachten
router.post('/', async (req, res) => {
  try {
    const {
      schuld,
      bilder,
      schadenBeschreibung,
      name,
      email,
      telefonnummer,
      plz,
      datenschutz,
      vorname,
      strasse,
      hausnummer,
      ort
    } = req.body;

    // Erstelle neue KfzGutachten-Anfrage
    const kfzGutachten = new KfzGutachten({
      schuld,
      bilder,
      schadenBeschreibung,
      name,
      email,
      telefonnummer,
      plz,
      datenschutz,
      vorname,
      strasse,
      hausnummer,
      ort,
      status: 'neu'
    });

    // Speichere in der Datenbank
    await kfzGutachten.save();

    // Sende Bestätigungs-E-Mail an Kunden
    await emailService.sendKfzGutachtenConfirmation({
      email,
      vorname,
      name
    });

    // Sende Benachrichtigung an Support
    await emailService.sendKfzGutachtenNotification({
      kfzGutachten
    });

    res.json({
      success: true,
      message: 'KfzGutachten-Anfrage erfolgreich gespeichert'
    });
  } catch (error) {
    console.error('Fehler beim Speichern der KfzGutachten-Anfrage:', error);
    res.status(500).json({
      success: false,
      error: 'Interner Server-Fehler',
      details: error.message
    });
  }
});

module.exports = router; 