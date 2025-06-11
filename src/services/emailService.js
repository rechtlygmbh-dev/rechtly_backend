const nodemailer = require('nodemailer');
const config = require('../config/config');
const logger = require('../utils/logger');
const path = require('path');
const { minioClient, BUCKET_NAME } = require('../config/config');
const { Readable } = require('stream');
const PDFDocument = require('pdfkit');
const fs = require('fs');

console.log('Nodemailer-Konfiguration:', {
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  user: config.email.auth.user,
  pass: config.email.auth.pass,
  from: config.email.from
});

function getBussgeldFormFields(anfrage) {
  const p = anfrage.person || {};
  const a = anfrage.allgemein || {};
  const k = anfrage.kosten || {};
  return [
    { label: 'Anrede', value: p.anrede },
    { label: 'Titel', value: p.titel },
    { label: 'Vorname', value: p.vorname },
    { label: 'Nachname', value: p.nachname },
    { label: 'Weitere Vornamen', value: p.weitereVornamen },
    { label: 'Geburtsname', value: p.geburtsname },
    { label: 'Geburtsdatum', value: p.geburtsdatum },
    { label: 'Geburtsort', value: p.geburtsort },
    { label: 'Straße', value: p.strasse },
    { label: 'Hausnummer', value: p.hausNr },
    { label: 'PLZ', value: p.plz },
    { label: 'Wohnort', value: p.wohnort },
    { label: 'E-Mail', value: p.email },
    { label: 'Telefon', value: p.telefon },
    { label: 'Aktenzeichen', value: p.aktenzeichen },
    { label: 'Zustellungsdatum', value: p.zustellungsdatum },
    { label: 'Behörde', value: p.behoerde },
    { label: 'Kennzeichen', value: p.kennzeichen },
    { label: 'Vorwurf', value: a.vorwurf },
    { label: 'Fahrzeugtyp', value: a.fahrzeugTyp },
    { label: 'Punktestand', value: a.punktestand },
    { label: 'Probezeit', value: a.probezeit },
    { label: 'Schreiben', value: a.schreiben },
    { label: 'Kostenübernahme', value: k.kostenuebernahme },
  ];
}

function generateBussgeldPdf(anfrage) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      resolve(Buffer.concat(buffers));
    });

    // Logo oben mittig
    const logoPath = path.join(__dirname, '../../public/assets/images/LOGO Transparent.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, doc.page.width / 2 - 60, 20, { width: 120, align: 'center' });
      doc.moveDown(2.5);
    } else {
      doc.moveDown(2);
    }

    // Überschrift
    doc.fontSize(18).font('Helvetica-Bold').text('Anfragenübersicht', { align: 'center' });
    doc.moveDown(1.5);

    // Tabelle
    const fields = getBussgeldFormFields(anfrage);
    const tableTop = doc.y;
    const col1Width = 180;
    const col2Width = 320;
    const rowHeight = 24;
    const tableLeft = doc.page.margins.left;
    const tableWidth = col1Width + col2Width;

    // Tabellenkopf
    doc.rect(tableLeft, tableTop, tableWidth, rowHeight).fillAndStroke('#f5f5f5', '#cccccc');
    doc
      .fillColor('#1B3A4B').font('Helvetica-Bold').fontSize(12)
      .text('Feld', tableLeft + 8, tableTop + 6, { width: col1Width - 16 })
      .text('Wert', tableLeft + col1Width + 8, tableTop + 6, { width: col2Width - 16 });
    doc.fillColor('black').font('Helvetica').fontSize(11);

    // Tabellenzeilen
    let y = tableTop + rowHeight;
    fields.forEach(({ label, value }) => {
      doc.rect(tableLeft, y, col1Width, rowHeight).stroke('#cccccc');
      doc.rect(tableLeft + col1Width, y, col2Width, rowHeight).stroke('#cccccc');
      doc.text(label, tableLeft + 8, y + 6, { width: col1Width - 16 });
      doc.text(value && value !== '' ? value : '—', tableLeft + col1Width + 8, y + 6, { width: col2Width - 16 });
      y += rowHeight;
    });

    doc.end();
  });
}

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.auth.user,
        pass: config.email.auth.pass
      }
    });
  }

  async sendActivationEmail(email, token) {
    const activationUrl = `${config.domains.base}/activate/${token}`;
    
    const mailOptions = {
      from: config.email.from,
      to: email,
      subject: 'Aktivieren Sie Ihr Rechtly-Konto',
      html: `
        <h1>Willkommen bei Rechtly!</h1>
        <p>Vielen Dank für Ihre Registrierung. Bitte aktivieren Sie Ihr Konto durch Klicken auf den folgenden Link:</p>
        <p><a href="${activationUrl}">${activationUrl}</a></p>
        <p>Der Link ist 24 Stunden gültig.</p>
        <p>Mit freundlichen Grüßen,<br>Ihr Rechtly-Team</p>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info(`Aktivierungs-Email gesendet an ${email}`);
    } catch (error) {
      logger.error(`Fehler beim Senden der Aktivierungs-Email an ${email}: ${error.message}`);
      throw error;
    }
  }

  async sendPasswordResetEmail(email, token) {
    const resetUrl = `${config.domains.base}/reset-password/${token}`;
    
    const mailOptions = {
      from: config.email.from,
      to: email,
      subject: 'Passwort zurücksetzen - Rechtly',
      html: `
        <h1>Passwort zurücksetzen</h1>
        <p>Sie haben angefordert, Ihr Passwort zurückzusetzen. Klicken Sie auf den folgenden Link, um ein neues Passwort festzulegen:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Der Link ist 1 Stunde gültig.</p>
        <p>Falls Sie keine Passwort-Zurücksetzung angefordert haben, können Sie diese E-Mail ignorieren.</p>
        <p>Mit freundlichen Grüßen,<br>Ihr Rechtly-Team</p>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info(`Passwort-Reset-Email gesendet an ${email}`);
    } catch (error) {
      logger.error(`Fehler beim Senden der Passwort-Reset-Email an ${email}: ${error.message}`);
      throw error;
    }
  }

  async sendWelcomeEmail(email, firstName) {
    const loginUrl = `${config.domains.base}/login`;
    
    const mailOptions = {
      from: config.email.from,
      to: email,
      subject: 'Willkommen bei Rechtly!',
      html: `
        <h1>Willkommen bei Rechtly, ${firstName}!</h1>
        <p>Ihr Konto wurde erfolgreich aktiviert. Sie können sich jetzt einloggen:</p>
        <p><a href="${loginUrl}">${loginUrl}</a></p>
        <p>Mit freundlichen Grüßen,<br>Ihr Rechtly-Team</p>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info(`Willkommens-Email gesendet an ${email}`);
    } catch (error) {
      logger.error(`Fehler beim Senden der Willkommens-Email an ${email}: ${error.message}`);
      throw error;
    }
  }

  async sendFaqContactMail({ vorname, nachname, email, telefon, nachricht }) {
    const logoUrl = process.env.NODE_ENV === 'production'
      ? 'https://rechtly.de/assets/images/logo-transparent.png'
      : 'http://localhost:3000/assets/images/logo-transparent.png';

    // E-Mail an Support
    await this.transporter.sendMail({
      from: 'noreply@rechtly.de',
      to: 'support@rechtly.de',
      subject: `Neue FAQ-Anfrage von ${vorname} ${nachname}`,
      html: `
        <div style="text-align:center;margin-bottom:24px;">
          <img src="${logoUrl}" alt="Rechtly Logo" style="max-width:220px;max-height:80px;" />
        </div>
        <h2>Neue FAQ-Anfrage</h2>
        <p><b>Name:</b> ${vorname} ${nachname}</p>
        <p><b>E-Mail:</b> ${email}</p>
        <p><b>Telefon:</b> ${telefon}</p>
        <p><b>Nachricht:</b><br>${nachricht}</p>
      `
    });
    // Bestätigungs-E-Mail an Kunden
    await this.transporter.sendMail({
      from: 'noreply@rechtly.de',
      to: email,
      subject: 'Ihre Anfrage bei Rechtly',
      html: `
        <div style="text-align:center;margin-bottom:24px;">
          <img src="${logoUrl}" alt="Rechtly Logo" style="max-width:220px;max-height:80px;" />
        </div>
        <h2>Vielen Dank für Ihre Anfrage!</h2>
        <p>Hallo ${vorname},</p>
        <p>wir haben Ihre Nachricht erhalten und melden uns schnellstmöglich bei Ihnen.</p>
        <p><b>Ihre Nachricht:</b><br>${nachricht}</p>
        <p>Ihr Rechtly-Team</p>
      `
    });
  }

  async sendKfzGutachtenConfirmation({ email, vorname, name }) {
    try {
      const mailOptions = {
        from: `"Rechtly" <${config.email.from}>`,
        to: email,
        subject: 'Ihre KfzGutachten-Anfrage bei Rechtly',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <img src="${config.domains.base}/assets/images/logo-transparent.png" alt="Rechtly Logo" style="max-width: 200px; margin-bottom: 20px;">
            <h2>Vielen Dank für Ihre KfzGutachten-Anfrage!</h2>
            <p>Sehr geehrte(r) ${vorname} ${name},</p>
            <p>wir haben Ihre KfzGutachten-Anfrage erfolgreich erhalten und werden uns schnellstmöglich bei Ihnen melden.</p>
            <p>Unsere Experten werden Ihre Unterlagen prüfen und sich innerhalb von 24 Stunden mit Ihnen in Verbindung setzen.</p>
            <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h3>Nächste Schritte:</h3>
              <ol>
                <li>Prüfung Ihrer eingereichten Unterlagen</li>
                <li>Kontaktaufnahme durch einen unserer Experten</li>
                <li>Detaillierte Schadensanalyse</li>
                <li>Beratung zu den weiteren Schritten</li>
              </ol>
            </div>
            <p>Bei dringenden Fragen erreichen Sie uns unter:</p>
            <p>📞 ${config.support.phone}<br>
            ✉️ ${config.support.email}</p>
            <p>Mit freundlichen Grüßen<br>Ihr Rechtly-Team</p>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Fehler beim Senden der KfzGutachten-Bestätigungsmail:', error);
      throw error;
    }
  }

  async sendKfzGutachtenNotification({ kfzGutachten }) {
    try {
      const mailOptions = {
        from: `"Rechtly System" <${config.email.from}>`,
        to: config.support.email,
        subject: 'Neue KfzGutachten-Anfrage',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Neue KfzGutachten-Anfrage</h2>
            <p>Eine neue KfzGutachten-Anfrage wurde eingereicht:</p>
            <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <p><strong>Name:</strong> ${kfzGutachten.vorname} ${kfzGutachten.name}</p>
              <p><strong>E-Mail:</strong> ${kfzGutachten.email}</p>
              <p><strong>Telefon:</strong> ${kfzGutachten.telefonnummer}</p>
              <p><strong>Adresse:</strong> ${kfzGutachten.strasse} ${kfzGutachten.hausnummer}, ${kfzGutachten.plz} ${kfzGutachten.ort}</p>
              <p><strong>Schuld:</strong> ${kfzGutachten.schuld === 'unfallgegner' ? 'Unfallgegner' : 'Selbst'}</p>
              <p><strong>Schadenbeschreibung:</strong> ${kfzGutachten.schadenBeschreibung}</p>
              <p><strong>Bilder:</strong></p>
              <ul>
                ${Object.entries(kfzGutachten.bilder).map(([kategorie, bilder]) => `
                  <li>${kategorie}: ${bilder.length} Bild(er)</li>
                `).join('')}
              </ul>
            </div>
            <p>Bitte prüfen Sie die Anfrage im Admin-Bereich.</p>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Fehler beim Senden der KfzGutachten-Benachrichtigung:', error);
      throw error;
    }
  }

  async sendBussgeldConfirmation({ email, vorname, name }) {
    try {
      const mailOptions = {
        from: `"Rechtly" <${config.email.from}>`,
        to: email,
        subject: 'Ihre Bussgeld-Anfrage bei Rechtly',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <img src="${config.domains.base}/assets/images/logo-transparent.png" alt="Rechtly Logo" style="max-width: 200px; margin-bottom: 20px;">
            <h2>Vielen Dank für Ihre Bussgeld-Anfrage!</h2>
            <p>Sehr geehrte(r) ${vorname} ${name},</p>
            <p>wir haben Ihre Bussgeld-Anfrage erfolgreich erhalten und werden uns schnellstmöglich bei Ihnen melden.</p>
            <p>Unsere Experten werden Ihre Unterlagen prüfen und sich innerhalb von 24 Stunden mit Ihnen in Verbindung setzen.</p>
            <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h3>Nächste Schritte:</h3>
              <ol>
                <li>Prüfung Ihrer eingereichten Unterlagen</li>
                <li>Kontaktaufnahme durch einen unserer Experten</li>
                <li>Rechtliche Einschätzung Ihres Falls</li>
                <li>Beratung zu den weiteren Schritten</li>
              </ol>
            </div>
            <p>Bei dringenden Fragen erreichen Sie uns unter:</p>
            <p>📞 ${config.support.phone}<br>
            ✉️ ${config.support.email}</p>
            <p>Mit freundlichen Grüßen<br>Ihr Rechtly-Team</p>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Fehler beim Senden der Bussgeld-Bestätigungsmail:', error);
      throw error;
    }
  }

  async sendBussgeldNotification({ bussgeld }) {
    try {
      const mailOptions = {
        from: `"Rechtly System" <${config.email.from}>`,
        to: config.support.email,
        subject: 'Neue Bussgeld-Anfrage',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Neue Bussgeld-Anfrage</h2>
            <p>Eine neue Bussgeld-Anfrage wurde eingereicht:</p>
            <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <p><strong>Service:</strong> ${bussgeld.service}</p>
              <p><strong>Name:</strong> ${bussgeld.vorname} ${bussgeld.name}</p>
              <p><strong>E-Mail:</strong> ${bussgeld.email}</p>
              <p><strong>Telefon:</strong> ${bussgeld.telefon}</p>
              <p><strong>Adresse:</strong> ${bussgeld.strasse} ${bussgeld.hausnummer}, ${bussgeld.plz} ${bussgeld.ort}</p>
              <p><strong>Beschreibung:</strong> ${bussgeld.bussgeldBeschreibung}</p>
              <p><strong>Dokumente:</strong> ${bussgeld.dokumente.length} Dokument(e) hochgeladen</p>
            </div>
            <p>Bitte prüfen Sie die Anfrage im Admin-Bereich.</p>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Fehler beim Senden der Bussgeld-Benachrichtigung:', error);
      throw error;
    }
  }

  async sendBussgeldAnfrageEmails({ anfrage, dokumente }) {
    try {
      console.log('Starte E-Mail-Versand für Bußgeldanfrage:', {
        kunde: anfrage.person.email,
        dokumente: dokumente.length
      });

      const logoUrl = process.env.NODE_ENV === 'production'
        ? 'https://rechtly.de/assets/images/logo-transparent.png'
        : 'http://localhost:3000/assets/images/logo-transparent.png';

      // Lade die Dokumente von MinIO
      console.log('Lade Dokumente von MinIO...');
      const attachments = await Promise.all(dokumente.map(async (doc) => {
        try {
          console.log(`Lade Dokument: ${doc.name} von ${doc.path}`);
          const dataStream = await minioClient.getObject(BUCKET_NAME, doc.path);
          const chunks = [];
          
          return new Promise((resolve, reject) => {
            dataStream.on('data', chunk => chunks.push(chunk));
            dataStream.on('end', () => {
              console.log(`Dokument ${doc.name} erfolgreich geladen`);
              resolve({
                filename: doc.name,
                content: Buffer.concat(chunks)
              });
            });
            dataStream.on('error', (error) => {
              console.error(`Fehler beim Laden von ${doc.name}:`, error);
              reject(error);
            });
          });
        } catch (error) {
          console.error(`Fehler beim Laden des Dokuments ${doc.name}:`, error);
          return null;
        }
      }));

      // Filtere fehlgeschlagene Downloads
      const validAttachments = attachments.filter(attachment => attachment !== null);
      console.log(`Erfolgreich geladene Dokumente: ${validAttachments.length}/${dokumente.length}`);

      // PDF generieren
      const pdfBuffer = await generateBussgeldPdf(anfrage);
      validAttachments.push({ filename: 'Anfragenübersicht.pdf', content: pdfBuffer });

      // HTML-Tabelle mit allen Feldern
      const fields = getBussgeldFormFields(anfrage);
      const tableRows = fields.map(f => `<tr><td style="padding:8px;border:1px solid #ddd;"><strong>${f.label}:</strong></td><td style="padding:8px;border:1px solid #ddd;">${f.value && f.value !== '' ? f.value : '—'}</td></tr>`).join('');

      // E-Mail-Inhalt für Kunden
      const mailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align:center;margin-bottom:24px;">
            <img src="cid:rechtlylogo" alt="Rechtly Logo" style="max-width:220px;max-height:80px;" />
          </div>
          <h2>Vielen Dank für Ihre Bußgeld-Anfrage!</h2>
          <p>Sehr geehrte(r) ${anfrage.person.vorname} ${anfrage.person.nachname},</p>
          <p>wir haben Ihre Bußgeld-Anfrage erfolgreich erhalten und werden uns schnellstmöglich bei Ihnen melden.</p>
          <p>Unsere Experten werden Ihre Unterlagen prüfen und sich innerhalb von 24 Stunden mit Ihnen in Verbindung setzen.</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3>Ihre Anfrage im Überblick:</h3>
            <table style="width: 100%; border-collapse: collapse;">${tableRows}</table>
          </div>

          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3>Nächste Schritte:</h3>
            <ol>
              <li>Prüfung Ihrer eingereichten Unterlagen</li>
              <li>Kontaktaufnahme durch einen unserer Experten</li>
              <li>Rechtliche Einschätzung Ihres Falls</li>
              <li>Beratung zu den weiteren Schritten</li>
            </ol>
          </div>

          <p>Bei dringenden Fragen erreichen Sie uns unter:</p>
          <p>📞 ${config.support.phone}<br>
          ✉️ ${config.support.email}</p>

          <p>Mit freundlichen Grüßen<br>Ihr Rechtly-Team</p>
        </div>
      `;

      // E-Mail-Inhalt für Rechtly-Team
      const mailHtmlTeam = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align:center;margin-bottom:24px;">
            <img src="cid:rechtlylogo" alt="Rechtly Logo" style="max-width:220px;max-height:80px;" />
          </div>
          <h2>Neue Bußgeld-Anfrage</h2>
          
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3>Alle Angaben:</h3>
            <table style="width: 100%; border-collapse: collapse;">${tableRows}</table>
          </div>

          <p>Eingegangen am: ${new Date().toLocaleString('de-DE')}</p>
        </div>
      `;

      // Mail an Kunden
      console.log('Sende E-Mail an Kunden...');
      await this.transporter.sendMail({
        from: 'noreply@rechtly.de',
        to: anfrage.person.email,
        subject: 'Ihre Bußgeld-Anfrage bei Rechtly',
        html: mailHtml,
        attachments: [
          {
            filename: 'LOGO Transparent.png',
            path: path.join(__dirname, '../../public/assets/images/LOGO Transparent.png'),
            cid: 'rechtlylogo'
          },
          ...validAttachments
        ]
      });
      console.log('E-Mail an Kunden erfolgreich versendet');

      // Mail an Rechtly
      console.log('Sende E-Mail an Rechtly-Team...');
      await this.transporter.sendMail({
        from: 'noreply@rechtly.de',
        to: 'anfragen@rechtly.de',
        subject: 'Neue Bußgeld-Anfrage',
        html: mailHtmlTeam,
        attachments: [
          {
            filename: 'LOGO Transparent.png',
            path: path.join(__dirname, '../../public/assets/images/LOGO Transparent.png'),
            cid: 'rechtlylogo'
          },
          ...validAttachments
        ]
      });
      console.log('E-Mail an Rechtly-Team erfolgreich versendet');

      return true;
    } catch (error) {
      console.error('Fehler beim Senden der Bußgeld-Anfrage E-Mails:', error);
      throw error;
    }
  }
}

module.exports = new EmailService(); 