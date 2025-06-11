const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');

router.post('/', async (req, res) => {
  const { vorname, nachname, email, telefon, nachricht } = req.body;
  if (!vorname || !nachname || !email || !telefon || !nachricht) {
    return res.status(400).json({ error: 'Alle Felder sind Pflichtfelder.' });
  }
  try {
    await emailService.sendFaqContactMail({ vorname, nachname, email, telefon, nachricht });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'E-Mail-Versand fehlgeschlagen.' });
  }
});

module.exports = router; 