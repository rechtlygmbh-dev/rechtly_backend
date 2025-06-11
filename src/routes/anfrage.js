const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const path = require('path');
const AnfrageEmailService = require('../services/anfrageEmailService');
const Anfrage = require('../models/Anfrage');
const emailService = require('../services/emailService');
const Document = require('../models/Document');
require('dotenv').config();

console.log('SMTP Config:', {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER
});

// SMTP-Konfiguration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

const validateEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

// Verkehrsunfall-Anfrage Route
router.post('/verkehrsunfall', async (req, res) => {
  try {
    console.log('Neue Verkehrsunfall-Anfrage erhalten:', JSON.stringify(req.body, null, 2)); // Debug-Log
    const data = req.body;
    
    // Validiere die Anfrage
    if (!data.email || !validateEmail(data.email)) {
      console.log('Validierungsfehler - Ungültige E-Mail:', data.email);
      return res.status(400).json({
        success: false,
        error: 'Ungültige E-Mail-Adresse',
        details: 'Bitte geben Sie eine gültige E-Mail-Adresse ein'
      });
    }

    // Extrahiere die Bild-IDs aus den hochgeladenen Bildern
    const imageIds = data.bilder.map(bild => bild.id);
    console.log('Bild-IDs aus Anfrage:', imageIds);

    // Hole die Bild-Metadaten aus der Document-Collection
    const dokumente = await Document.find({ _id: { $in: imageIds } });
    console.log('Gefundene Dokumente in MongoDB:', dokumente);

    // Baue das Anfrage-Objekt für MongoDB
    const anfrageObj = {
      anfrageTyp: 'verkehrsunfall',
      vorname: data.vorname || '',
      nachname: data.nachname || '',
      email: data.email,
      telefon: data.telefon || '',
      strasse: data.strasse || '',
      hausnummer: data.hausnummer || '',
      plz: data.plz || '',
      ort: data.ort || '',
      verkehrsunfall: {
        unfallverursacher: data.unfallverursacher,
        unfallDatum: data.unfallDatum,
        unfallZeit: data.unfallZeit,
        strasse: data.strasse,
        plz: data.plz,
        weitereAngaben: data.weitereAngaben,
        unfallhergang: data.unfallhergang,
        reaktion: data.reaktion,
        verkehrszeichen: data.verkehrszeichen,
        fahrzeugDetails: data.fahrzeugDetails,
        polizei: data.polizei,
        zeugen: data.zeugen,
        personenschaden: data.personenschaden,
        rettungsdienst: data.rettungsdienst
      },
      dokumente: dokumente.map(doc => ({
        id: doc._id,
        name: doc.dokumente[0]?.filename || doc.filename || '',
        path: doc.dokumente[0]?.pfad || doc.path || ''
      })),
      datenschutz: data.dsgvoEinwilligung === true || data.dsgvoEinwilligung === 'true',
      anwaltEinwilligung: data.anwaltEinwilligung === true || data.anwaltEinwilligung === 'true',
      status: 'neu'
    };
    console.log('Anfrage-Objekt für MongoDB:', JSON.stringify(anfrageObj, null, 2));

    // Speichere die Anfrage in MongoDB
    const anfrage = new Anfrage(anfrageObj);
    await anfrage.save();
    console.log('Anfrage erfolgreich in MongoDB gespeichert:', anfrage._id);

    // Sende Bestätigungsmails mit Bildern
    await AnfrageEmailService.sendVerkehrsunfallBestaetigungEmails(data, imageIds);
    console.log('E-Mails für Verkehrsunfall-Anfrage erfolgreich versendet.');

    res.json({ success: true, anfrageId: anfrage._id });
  } catch (error) {
    console.error('Fehler bei der Verkehrsunfall-Anfrage:', error);
    res.status(500).json({
      success: false,
      error: 'Anfrage fehlgeschlagen',
      details: error.message
    });
  }
});

router.post('/bussgeld', async (req, res) => {
  try {
    console.log('Anfrage erhalten:', req.body); // Debug-Log
    const data = req.body;

    // Validierung der E-Mail
    if (!data.person.email || !validateEmail(data.person.email)) {
      return res.status(400).json({
        success: false,
        error: 'Ungültige E-Mail-Adresse',
        details: 'Bitte geben Sie eine gültige E-Mail-Adresse ein'
      });
    }

    // Dokumenten-Anhänge für interne Mail
    const dokumenteAttachments = (data.allgemein?.dokumente && Array.isArray(data.allgemein.dokumente) && data.allgemein.dokumente.length > 0)
      ? data.allgemein.dokumente.map(f => ({
          filename: typeof f === 'string' ? f : (f.name || 'Datei'),
          path: path.join(__dirname, '../../uploads/', typeof f === 'string' ? f : (f.name || 'Datei'))
        }))
      : [];

    const dokumenteList = (data.allgemein?.dokumente && Array.isArray(data.allgemein.dokumente) && data.allgemein.dokumente.length > 0)
      ? `${data.allgemein.dokumente.length} Dokument(e):<br>` +
        data.allgemein.dokumente.map(f => {
          const fileName = typeof f === 'string' ? f : (f.name || 'Datei');
          return `${fileName}`;
        }).join('<br>')
      : '—';

    // E-Mail-Inhalt für Kunden (HTML)
    const mailHtml = `
      <div style="text-align:center;">
        <img src="cid:rechtlylogo" alt="Rechtly Logo" style="width:220px; margin-bottom:20px;" />
        <h2>🚦 Vielen Dank für Ihre Anfrage bei Rechtly!</h2>
        <p>Wir haben Ihre Angaben erhalten und werden diese umgehend prüfen.</p>
        <p>📬 <b>In einer separaten E-Mail erhalten Sie in Kürze Ihre persönliche Vorabanalyse.</b></p>
        <hr style="margin:24px 0;">
        <h3>Ihre Angaben:</h3>
        <div style="text-align:left; display:inline-block; margin:0 auto;">
          <ul style="list-style:none; padding:0;">
            <li>🧑‍⚖️ <b>Anrede:</b> ${data.person.anrede || '—'}</li>
            <li>🎓 <b>Titel:</b> ${data.person.titel || '—'}</li>
            <li>👤 <b>Name:</b> ${data.person.vorname} ${data.person.nachname}</li>
            <li>🧑‍🤝‍🧑 <b>Weitere Vornamen:</b> ${data.person.weitereVornamen || '—'}</li>
            <li>👶 <b>Geburtsname:</b> ${data.person.geburtsname || '—'}</li>
            <li>📍 <b>Geburtsort:</b> ${data.person.geburtsort || '—'}</li>
            <li>🎂 <b>Geburtsdatum:</b> ${data.person.geburtsdatum}</li>
            <li>🏠 <b>Straße:</b> ${data.person.strasse}</li>
            <li>#️⃣ <b>Hausnummer:</b> ${data.person.hausNr || '—'}</li>
            <li>🏙️ <b>PLZ/Ort:</b> ${data.person.plz} ${data.person.wohnort}</li>
            <li>📞 <b>Telefon:</b> ${data.person.telefon || '—'}</li>
            <li>✉️ <b>E-Mail:</b> ${data.person.email}</li>
            <li>📁 <b>Aktenzeichen:</b> ${data.person.aktenzeichen || '—'}</li>
            <li>📅 <b>Zustellungsdatum:</b> ${data.person.zustellungsdatum || '—'}</li>
            <li>🏢 <b>Behörde:</b> ${data.person.behoerde || '—'}</li>
            <li>🚗 <b>Kennzeichen:</b> ${data.person.kennzeichen || '—'}</li>
            <li>⚖️ <b>Was wird Ihnen vorgeworfen?</b> ${data.allgemein?.vorwurf || '—'}</li>
            <li>🚙 <b>Mit welchem Fahrzeug waren Sie unterwegs?</b> ${data.allgemein?.fahrzeugTyp || '—'}</li>
            <li>🏅 <b>Punktestand in Flensburg:</b> ${data.allgemein?.punktestand || '—'}</li>
            <li>🕒 <b>Waren Sie in der Probezeit?</b> ${data.allgemein?.probezeit || '—'}</li>
            <li>📄 <b>Welches Schreiben haben Sie erhalten?</b> ${data.allgemein?.schreiben || '—'}</li>
            <li>🛡️ <b>Rechtsschutzversicherung:</b> ${data.kosten?.kostenuebernahme === 'versicherung' ? 'Ja' : (data.kosten?.kostenuebernahme === 'selbst' ? 'Nein' : '—')}</li>
            <li>📎 <b>Hochgeladene Dokumente:</b> ${dokumenteList}</li>
          </ul>
        </div>
        <p style="margin-top:32px;">Ihr Rechtly-Team<br>Verkehrsrecht. Einfach. Digital.</p>
      </div>
    `;

    // E-Mail-Inhalt für Rechtly-Team (HTML)
    const mailHtmlTeam = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <img src="cid:rechtlylogo" alt="Rechtly Logo" style="width:180px; margin-bottom:20px;" />
        <h2>🚦 Neue Bußgeld-Anfrage</h2>
        <table style="border-collapse:collapse; width:100%; background:#f9f9f9;">
          <tbody>
            <tr><td style="padding:8px; border:1px solid #ddd;">🧑‍⚖️ <b>Anrede</b></td><td style="padding:8px; border:1px solid #ddd;">${data.person.anrede || '—'}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">🎓 <b>Titel</b></td><td style="padding:8px; border:1px solid #ddd;">${data.person.titel || '—'}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">👤 <b>Name</b></td><td style="padding:8px; border:1px solid #ddd;">${data.person.vorname} ${data.person.nachname}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">🧑‍🤝‍🧑 <b>Weitere Vornamen</b></td><td style="padding:8px; border:1px solid #ddd;">${data.person.weitereVornamen || '—'}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">👶 <b>Geburtsname</b></td><td style="padding:8px; border:1px solid #ddd;">${data.person.geburtsname || '—'}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">📍 <b>Geburtsort</b></td><td style="padding:8px; border:1px solid #ddd;">${data.person.geburtsort || '—'}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">🎂 <b>Geburtsdatum</b></td><td style="padding:8px; border:1px solid #ddd;">${data.person.geburtsdatum}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">🏠 <b>Straße</b></td><td style="padding:8px; border:1px solid #ddd;">${data.person.strasse}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">#️⃣ <b>Hausnummer</b></td><td style="padding:8px; border:1px solid #ddd;">${data.person.hausNr || '—'}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">🏙️ <b>PLZ/Ort</b></td><td style="padding:8px; border:1px solid #ddd;">${data.person.plz} ${data.person.wohnort}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">📞 <b>Telefon</b></td><td style="padding:8px; border:1px solid #ddd;">${data.person.telefon || '—'}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">✉️ <b>E-Mail</b></td><td style="padding:8px; border:1px solid #ddd;">${data.person.email}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">✅ <b>E-Mail-Bestätigung</b></td><td style="padding:8px; border:1px solid #ddd;">${data.person.emailBestaetigung || '—'}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">📁 <b>Aktenzeichen</b></td><td style="padding:8px; border:1px solid #ddd;">${data.person.aktenzeichen || '—'}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">📅 <b>Zustellungsdatum</b></td><td style="padding:8px; border:1px solid #ddd;">${data.person.zustellungsdatum || '—'}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">🏢 <b>Behörde</b></td><td style="padding:8px; border:1px solid #ddd;">${data.person.behoerde || '—'}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">🚗 <b>Kennzeichen</b></td><td style="padding:8px; border:1px solid #ddd;">${data.person.kennzeichen || '—'}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">⚖️ <b>Vorwurf</b></td><td style="padding:8px; border:1px solid #ddd;">${data.allgemein?.vorwurf || '—'}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">🚙 <b>Fahrzeug</b></td><td style="padding:8px; border:1px solid #ddd;">${data.allgemein?.fahrzeugTyp || '—'}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">🏅 <b>Punktestand</b></td><td style="padding:8px; border:1px solid #ddd;">${data.allgemein?.punktestand || '—'}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">🕒 <b>Probezeit</b></td><td style="padding:8px; border:1px solid #ddd;">${data.allgemein?.probezeit || '—'}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">📄 <b>Schreiben</b></td><td style="padding:8px; border:1px solid #ddd;">${data.allgemein?.schreiben || '—'}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">🛡️ <b>Rechtsschutzversicherung</b></td><td style="padding:8px; border:1px solid #ddd;">${data.kosten?.kostenuebernahme === 'versicherung' ? 'Ja' : (data.kosten?.kostenuebernahme === 'selbst' ? 'Nein' : '—')}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">📎 <b>Dokumente</b></td><td style="padding:8px; border:1px solid #ddd;">${dokumenteList}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">📬 <b>Kontaktformular Name</b></td><td style="padding:8px; border:1px solid #ddd;">${data.kontakt?.name || '—'}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">📧 <b>Kontaktformular E-Mail</b></td><td style="padding:8px; border:1px solid #ddd;">${data.kontakt?.email || '—'}</td></tr>
            <tr><td style="padding:8px; border:1px solid #ddd;">💬 <b>Kontaktformular Nachricht</b></td><td style="padding:8px; border:1px solid #ddd;">${data.kontakt?.nachricht || '—'}</td></tr>
          </tbody>
        </table>
        <p style="margin-top:32px;">Eingegangen am: ${new Date().toLocaleString('de-DE')}</p>
      </div>
    `;

    // Mail an Rechtly
    await transporter.sendMail({
      from: `"Rechtly Anfrage" <${process.env.SMTP_USER}>`,
      to: 'Anfragen@rechtly.de',
      subject: 'Neue Bußgeld-Anfrage',
      html: mailHtmlTeam,
      attachments: [
        {
          filename: 'LOGO Transparent.png',
          path: path.join(__dirname, '../../public/assets/images/LOGO Transparent.png'),
          cid: 'rechtlylogo'
        },
        ...dokumenteAttachments
      ]
    });

    // Mail an Kunden
    await transporter.sendMail({
      from: `"Rechtly" <${process.env.SMTP_USER}>`,
      to: data.person.email,
      subject: '🚦 Ihre Bußgeld-Anfrage bei Rechtly',
      html: mailHtml,
      attachments: [
        {
          filename: 'LOGO Transparent.png',
          path: path.join(__dirname, '../../public/assets/images/LOGO Transparent.png'),
          cid: 'rechtlylogo'
        },
        ...dokumenteAttachments
      ]
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Detaillierter Fehler:', error);
    res.status(500).json({ 
      success: false, 
      error: 'E-Mail-Versand fehlgeschlagen',
      details: error.message 
    });
  }
});

// Kfz-Gutachten-Anfrage Route
router.post('/kfz-gutachten', async (req, res) => {
  try {
    console.log('Neue Kfz-Gutachten-Anfrage erhalten:', JSON.stringify(req.body, null, 2));
    const data = req.body;

    // Validiere die Anfrage
    if (!data.email || !validateEmail(data.email)) {
      console.log('Validierungsfehler - Ungültige E-Mail:', data.email);
      return res.status(400).json({
        success: false,
        error: 'Ungültige E-Mail-Adresse',
        details: 'Bitte geben Sie eine gültige E-Mail-Adresse ein'
      });
    }

    // Extrahiere die Dokumenten-IDs
    const dokumentenIds = (data.dokumente || []).map(doc => doc.id);
    console.log('Dokumenten-IDs aus Anfrage:', dokumentenIds);

    // Hole die Dokumente aus der Document-Collection
    const dokumente = await Document.find({ _id: { $in: dokumentenIds } });
    console.log('Gefundene Dokumente in MongoDB:', dokumente);

    // Baue das Anfrage-Objekt für MongoDB
    const anfrageObj = {
      anfrageTyp: 'kfz-gutachten',
      anrede: data.anrede || '',
      titel: data.titel || '',
      vorname: data.vorname || '',
      nachname: data.nachname || '',
      email: data.email,
      telefon: data.telefon || '',
      strasse: data.strasse || '',
      hausnummer: data.hausnummer || '',
      plz: data.plz || '',
      ort: data.ort || '',
      kfzGutachten: data.kfzGutachten || {},
      dokumente: dokumente.map(doc => ({
        id: doc._id,
        name: doc.dokumente[0]?.filename || doc.filename || '',
        path: doc.dokumente[0]?.pfad || doc.path || ''
      })),
      datenschutz: true,
      anwaltEinwilligung: true,
      status: 'neu'
    };
    console.log('Anfrage-Objekt für MongoDB:', JSON.stringify(anfrageObj, null, 2));

    // Speichere die Anfrage in MongoDB
    const anfrage = new Anfrage(anfrageObj);
    await anfrage.save();
    console.log('Kfz-Gutachten-Anfrage erfolgreich in MongoDB gespeichert:', anfrage._id);

    // Sende Bestätigungsmails mit Dokumenten
    if (AnfrageEmailService.sendKfzGutachtenBestaetigungEmails) {
      await AnfrageEmailService.sendKfzGutachtenBestaetigungEmails(data, dokumentenIds);
      console.log('E-Mails für Kfz-Gutachten-Anfrage erfolgreich versendet.');
    } else {
      console.warn('E-Mail-Service für Kfz-Gutachten ist noch nicht implementiert!');
    }

    res.json({ success: true, anfrageId: anfrage._id });
  } catch (error) {
    console.error('Fehler bei der Kfz-Gutachten-Anfrage:', error);
    res.status(500).json({
      success: false,
      error: 'Anfrage fehlgeschlagen',
      details: error.message
    });
  }
});

// POST /api/anfrage - Neue Anfrage erstellen
router.post('/', async (req, res) => {
  try {
    console.log('Neue Anfrage erhalten:', req.body); // Debug-Log

    const {
      anfrageTyp,
      // Kontaktdaten
      anrede,
      titel,
      vorname,
      nachname,
      email,
      telefon,
      strasse,
      hausnummer,
      plz,
      ort,
      // Spezifische Daten je nach AnfrageTyp
      bussgeld,
      verkehrsunfall,
      kfzGutachten,
      // Gemeinsame Felder
      dokumente,
      datenschutz,
      anwaltEinwilligung
    } = req.body;

    // Validiere Pflichtfelder
    if (!anfrageTyp || !vorname || !nachname || !email || !strasse || !plz || !ort) {
      console.log('Validierungsfehler - Fehlende Pflichtfelder:', {
        anfrageTyp,
        vorname,
        nachname,
        email,
        strasse,
        plz,
        ort
      });
      return res.status(400).json({
        success: false,
        error: 'Bitte füllen Sie alle Pflichtfelder aus',
        details: 'Folgende Pflichtfelder fehlen: ' + 
          (!anfrageTyp ? 'Anfrage-Typ, ' : '') +
          (!vorname ? 'Vorname, ' : '') +
          (!nachname ? 'Nachname, ' : '') +
          (!email ? 'E-Mail, ' : '') +
          (!strasse ? 'Straße, ' : '') +
          (!plz ? 'PLZ, ' : '') +
          (!ort ? 'Ort' : '')
      });
    }

    // Validiere E-Mail
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      console.log('Validierungsfehler - Ungültige E-Mail:', email);
      return res.status(400).json({
        success: false,
        error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
        details: 'Die eingegebene E-Mail-Adresse ist ungültig'
      });
    }

    // Validiere PLZ
    const plzRegex = /^[0-9]{5}$/;
    if (!plzRegex.test(plz)) {
      console.log('Validierungsfehler - Ungültige PLZ:', plz);
      return res.status(400).json({
        success: false,
        error: 'Bitte geben Sie eine gültige PLZ ein',
        details: 'Die PLZ muss aus 5 Ziffern bestehen'
      });
    }

    // Erstelle neue Anfrage
    const anfrage = new Anfrage({
      anfrageTyp,
      anrede,
      titel,
      vorname,
      nachname,
      email,
      telefon,
      strasse,
      hausnummer,
      plz,
      ort,
      bussgeld: anfrageTyp === 'bussgeld' ? bussgeld : undefined,
      verkehrsunfall: anfrageTyp === 'verkehrsunfall' ? verkehrsunfall : undefined,
      kfzGutachten: anfrageTyp === 'kfz-gutachten' ? kfzGutachten : undefined,
      dokumente,
      datenschutz,
      anwaltEinwilligung
    });

    console.log('Speichere neue Anfrage:', anfrage); // Debug-Log

    // Speichere die Anfrage
    await anfrage.save();

    console.log('Anfrage erfolgreich gespeichert:', anfrage._id); // Debug-Log

    res.status(201).json({
      success: true,
      message: 'Anfrage erfolgreich gespeichert',
      anfrageId: anfrage._id
    });

  } catch (error) {
    console.error('Fehler beim Speichern der Anfrage:', error);
    res.status(500).json({
      success: false,
      error: 'Ein Fehler ist aufgetreten',
      details: error.message
    });
  }
});

// GET /api/anfrage - Alle Anfragen abrufen
router.get('/', async (req, res) => {
  try {
    const anfragen = await Anfrage.find().sort({ erstelltAm: -1 });
    res.json({
      success: true,
      anfragen
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Anfragen:', error);
    res.status(500).json({
      success: false,
      error: 'Ein Fehler ist aufgetreten'
    });
  }
});

// GET /api/anfrage/:id - Einzelne Anfrage abrufen
router.get('/:id', async (req, res) => {
  try {
    const anfrage = await Anfrage.findById(req.params.id);
    if (!anfrage) {
      return res.status(404).json({
        success: false,
        error: 'Anfrage nicht gefunden'
      });
    }
    res.json({
      success: true,
      anfrage
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Anfrage:', error);
    res.status(500).json({
      success: false,
      error: 'Ein Fehler ist aufgetreten'
    });
  }
});

// PUT /api/anfrage/:id - Anfrage aktualisieren
router.put('/:id', async (req, res) => {
  try {
    const anfrage = await Anfrage.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!anfrage) {
      return res.status(404).json({
        success: false,
        error: 'Anfrage nicht gefunden'
      });
    }
    res.json({
      success: true,
      anfrage
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Anfrage:', error);
    res.status(500).json({
      success: false,
      error: 'Ein Fehler ist aufgetreten'
    });
  }
});

// POST /api/anfrage/email - E-Mails für Bußgeldanfrage senden
router.post('/email', async (req, res) => {
  try {
    const { anfrage, dokumente } = req.body;
    
    // Sende E-Mails über den EmailService
    await emailService.sendBussgeldAnfrageEmails({ anfrage, dokumente });

    res.json({ success: true });
  } catch (error) {
    console.error('Fehler beim Senden der E-Mails:', error);
    res.status(500).json({
      success: false,
      error: 'E-Mail-Versand fehlgeschlagen',
      details: error.message
    });
  }
});

module.exports = router; 