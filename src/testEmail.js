require('dotenv').config({ path: __dirname + '/../.env' });
const emailService = require('./services/emailService');

async function test() {
  try {
    await emailService.sendFaqContactMail({
      vorname: 'Test',
      nachname: 'User',
      email: 'deine@email.de', // <--- Hier deine echte E-Mail eintragen!
      telefon: '0123456789',
      nachricht: 'Dies ist ein Test der FAQ-Kontaktfunktion.'
    });
    console.log('E-Mail erfolgreich versendet!');
  } catch (err) {
    console.error('Fehler beim E-Mail-Versand:', err, err?.stack);
  }
}

test(); 