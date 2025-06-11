const express = require('express');
const router = express.Router();
const anfrageController = require('../controllers/anfrageController');
const emailService = require('../services/emailService');

// Bestehende Routen
router.post('/', anfrageController.createAnfrage);
router.get('/', anfrageController.getAnfragen);
router.get('/:id', anfrageController.getAnfrageById);
router.put('/:id', anfrageController.updateAnfrage);
router.delete('/:id', anfrageController.deleteAnfrage);

// Neue Route für E-Mail-Versand
router.post('/email', async (req, res) => {
  try {
    const { anfrage, dokumente } = req.body;
    
    // Sende E-Mails
    await emailService.sendBussgeldAnfrageEmails({ anfrage, dokumente });
    
    res.json({ success: true, message: 'E-Mails erfolgreich versendet' });
  } catch (error) {
    console.error('Fehler beim E-Mail-Versand:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Fehler beim Versenden der E-Mails',
      details: error.message 
    });
  }
});

module.exports = router; 