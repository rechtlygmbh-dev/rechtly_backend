const nodemailer = require('nodemailer');
const path = require('path');
const Image = require('../models/Image');
const smtpConfig = require('../config/smtp');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const Document = require('../models/Document');
const { minioClient, BUCKET_NAME } = require('../config/config');

// SMTP-Konfiguration
const transporter = nodemailer.createTransport({
  host: smtpConfig.host,
  port: smtpConfig.port,
  secure: smtpConfig.secure,
  auth: smtpConfig.auth
});

class AnfrageEmailService {
  static async sendVerkehrsunfallBestaetigungEmails(data, imageIds) {
    try {
      // Hole die Dokumente aus der Datenbank (Document statt Image)
      const documents = await Document.find({ _id: { $in: imageIds } });
      // Extrahiere alle enthaltenen Dateien aus dem dokumente-Array
      const docFiles = documents.flatMap(doc =>
        (doc.dokumente && Array.isArray(doc.dokumente))
          ? doc.dokumente.map(d => ({
              filename: d.filename,
              pfad: d.pfad
            }))
          : []
      );
      // Lade die Dateien aus MinIO als Buffer
      const attachmentsFromMinio = await Promise.all(
        docFiles.map(async file => {
          try {
            const stream = await minioClient.getObject(BUCKET_NAME, file.pfad);
            const chunks = [];
            for await (const chunk of stream) {
              chunks.push(chunk);
            }
            return {
              filename: file.filename,
              content: Buffer.concat(chunks)
            };
          } catch (err) {
            console.error('Fehler beim Laden aus MinIO:', file.pfad, err);
            return null;
          }
        })
      );
      // Filtere fehlerhafte Attachments raus
      const validAttachments = attachmentsFromMinio.filter(Boolean);
      // PDF generieren
      const pdfBuffer = await generateVerkehrsunfallPdf(data);
      // Attachments: Logo, PDF, alle Dokumente
      const attachments = [
          {
            filename: 'LOGO Transparent.png',
          path: path.join(__dirname, '../../public/assets/images/LOGO Transparent.png'),
            cid: 'rechtlylogo'
        },
        {
          filename: 'Verkehrsunfall-Anfrage.pdf',
          content: pdfBuffer
        },
        ...validAttachments
      ];

      // E-Mail-Inhalt für Kunden
      const mailHtml = `
      <div style="text-align:center;">
        <img src="cid:rechtlylogo" alt="Rechtly Logo" style="width:220px; margin-bottom:20px;" />
        <h2>🚗 Vielen Dank für Ihre Verkehrsunfall-Anfrage bei Rechtly!</h2>
        <p>Wir haben Ihre Angaben erhalten und werden diese umgehend prüfen.</p>
        <p>📬 <b>In einer separaten E-Mail erhalten Sie in Kürze Ihre persönliche Vorabanalyse.</b></p>
        <hr style="margin:24px 0;">
        <h3>Ihre Angaben:</h3>
        <div style="text-align:left; display:inline-block; margin:0 auto;">
          <ul style="list-style:none; padding:0;">
              <li>👤 <b>Name:</b> ${data.vorname} ${data.nachname}</li>
              <li>📧 <b>E-Mail:</b> ${data.email}</li>
              <li>📞 <b>Telefon:</b> ${data.telefon || '—'}</li>
              <li>🚗 <b>Unfallverursacher:</b> ${data.unfall?.verursacher || data.unfallverursacher || '—'}</li>
              <li>📅 <b>Unfalldatum:</b> ${data.unfall?.datum || data.unfallDatum || '—'}</li>
              <li>⏰ <b>Unfallzeit:</b> ${data.unfall?.zeit || data.unfallZeit || '—'}</li>
              <li>📍 <b>Unfallort:</b> ${data.unfall?.strasse || data.strasse || '—'}, ${data.unfall?.plz || data.plz || '—'}</li>
              <li>📝 <b>Weitere Angaben:</b> ${data.unfall?.weitereAngaben || data.weitereAngaben || '—'}</li>
              <li>📸 <b>Hochgeladene Bilder:</b> ${validAttachments.length} Dokument(e)</li>
            </ul>
          </div>
          <p style="margin-top:32px;">Ihr Rechtly-Team<br>Verkehrsrecht. Einfach. Digital.</p>
      </div>
    `;

      // E-Mail-Inhalt für Rechtly-Team
      const mailHtmlTeam = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <img src="cid:rechtlylogo" alt="Rechtly Logo" style="width:180px; margin-bottom:20px;" />
        <h2>🚗 Neue Verkehrsunfall-Anfrage</h2>
        <table style="border-collapse:collapse; width:100%; background:#f9f9f9;">
          <tbody>
              <tr><td style="padding:8px; border:1px solid #ddd;">👤 <b>Name</b></td><td style="padding:8px; border:1px solid #ddd;">${data.vorname} ${data.nachname}</td></tr>
              <tr><td style="padding:8px; border:1px solid #ddd;">📧 <b>E-Mail</b></td><td style="padding:8px; border:1px solid #ddd;">${data.email}</td></tr>
              <tr><td style="padding:8px; border:1px solid #ddd;">📞 <b>Telefon</b></td><td style="padding:8px; border:1px solid #ddd;">${data.telefon || '—'}</td></tr>
              <tr><td style="padding:8px; border:1px solid #ddd;">🚗 <b>Unfallverursacher</b></td><td style="padding:8px; border:1px solid #ddd;">${data.unfall?.verursacher || data.unfallverursacher || '—'}</td></tr>
              <tr><td style="padding:8px; border:1px solid #ddd;">📅 <b>Unfalldatum</b></td><td style="padding:8px; border:1px solid #ddd;">${data.unfall?.datum || data.unfallDatum || '—'}</td></tr>
              <tr><td style="padding:8px; border:1px solid #ddd;">⏰ <b>Unfallzeit</b></td><td style="padding:8px; border:1px solid #ddd;">${data.unfall?.zeit || data.unfallZeit || '—'}</td></tr>
              <tr><td style="padding:8px; border:1px solid #ddd;">📍 <b>Unfallort</b></td><td style="padding:8px; border:1px solid #ddd;">${data.unfall?.strasse || data.strasse || '—'}, ${data.unfall?.plz || data.plz || '—'}</td></tr>
              <tr><td style="padding:8px; border:1px solid #ddd;">📝 <b>Weitere Angaben</b></td><td style="padding:8px; border:1px solid #ddd;">${data.unfall?.weitereAngaben || data.weitereAngaben || '—'}</td></tr>
              <tr><td style="padding:8px; border:1px solid #ddd;">📸 <b>Dokumente</b></td><td style="padding:8px; border:1px solid #ddd;">${validAttachments.length} Dokument(e)</td></tr>
            </tbody>
          </table>
          <p style="margin-top:32px;">Eingegangen am: ${new Date().toLocaleString('de-DE')}</p>
        </div>
      `;

      // Mail an Rechtly
      await transporter.sendMail({
        from: smtpConfig.from,
        to: 'Anfragen@rechtly.de',
        subject: 'Neue Verkehrsunfall-Anfrage',
        html: mailHtmlTeam,
        attachments
      });

      // Mail an Kunden
      await transporter.sendMail({
        from: smtpConfig.from,
        to: data.email,
        subject: '🚗 Ihre Verkehrsunfall-Anfrage bei Rechtly',
        html: mailHtml,
        attachments
      });

      return true;
    } catch (error) {
      console.error('Fehler beim Senden der E-Mails:', error);
      throw error;
    }
  }

  static async sendKfzGutachtenBestaetigungEmails(data, dokumentenIds) {
    try {
      // Hole die Dokumente aus der Datenbank
      const documents = await Document.find({ _id: { $in: dokumentenIds } });
      // Extrahiere alle enthaltenen Dateien aus dem dokumente-Array
      const docFiles = documents.flatMap(doc =>
        (doc.dokumente && Array.isArray(doc.dokumente))
          ? doc.dokumente.map(d => ({
              filename: d.filename,
              pfad: d.pfad
            }))
          : []
      );
      // Lade die Dateien aus MinIO als Buffer
      const attachmentsFromMinio = await Promise.all(
        docFiles.map(async file => {
          try {
            const stream = await minioClient.getObject(BUCKET_NAME, file.pfad);
            const chunks = [];
            for await (const chunk of stream) {
              chunks.push(chunk);
            }
            return {
              filename: file.filename,
              content: Buffer.concat(chunks)
            };
          } catch (err) {
            console.error('Fehler beim Laden aus MinIO:', file.pfad, err);
            return null;
          }
        })
      );
      const validAttachments = attachmentsFromMinio.filter(Boolean);
      // PDF generieren
      const pdfBuffer = await generateKfzGutachtenPdf(data);
      // Attachments: Logo, PDF, alle Dokumente
      const attachments = [
        {
          filename: 'LOGO Transparent.png',
          path: path.join(__dirname, '../../public/assets/images/LOGO Transparent.png'),
          cid: 'rechtlylogo'
        },
        {
          filename: 'Kfz-Gutachten-Anfrage.pdf',
          content: pdfBuffer
        },
        ...validAttachments
      ];
      // E-Mail-Inhalt für Kunden
      const mailHtml = `
        <div style="text-align:center;">
          <img src="cid:rechtlylogo" alt="Rechtly Logo" style="width:220px; margin-bottom:20px;" />
          <h2>🚗 Vielen Dank für Ihre Kfz-Gutachten-Anfrage bei Rechtly!</h2>
          <p>Wir haben Ihre Angaben erhalten und werden diese umgehend prüfen.</p>
          <hr style="margin:24px 0;">
          <h3>Ihre Angaben:</h3>
          <div style="text-align:left; display:inline-block; margin:0 auto;">
            <ul style="list-style:none; padding:0;">
              <li>👤 <b>Name:</b> ${data.vorname} ${data.nachname}</li>
              <li>📧 <b>E-Mail:</b> ${data.email}</li>
              <li>📞 <b>Telefon:</b> ${data.telefon || '—'}</li>
              <li>🚗 <b>Fahrzeug:</b> ${data.kfzGutachten?.fahrzeugTyp || '—'} ${data.kfzGutachten?.marke || ''} ${data.kfzGutachten?.modell || ''}</li>
              <li>📝 <b>Schadensart:</b> ${data.kfzGutachten?.schadensart || '—'}</li>
              <li>📝 <b>Schadensbeschreibung:</b> ${data.kfzGutachten?.schadensbeschreibung || '—'}</li>
              <li>📸 <b>Hochgeladene Dokumente:</b> ${validAttachments.length} Datei(en)</li>
            </ul>
          </div>
          <p style="margin-top:32px;">Ihr Rechtly-Team<br>Verkehrsrecht. Einfach. Digital.</p>
        </div>
      `;
      // E-Mail-Inhalt für Rechtly-Team
      const mailHtmlTeam = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
          <img src="cid:rechtlylogo" alt="Rechtly Logo" style="width:180px; margin-bottom:20px;" />
          <h2>🚗 Neue Kfz-Gutachten-Anfrage</h2>
          <table style="border-collapse:collapse; width:100%; background:#f9f9f9;">
            <tbody>
              <tr><td style="padding:8px; border:1px solid #ddd;">👤 <b>Name</b></td><td style="padding:8px; border:1px solid #ddd;">${data.vorname} ${data.nachname}</td></tr>
              <tr><td style="padding:8px; border:1px solid #ddd;">📧 <b>E-Mail</b></td><td style="padding:8px; border:1px solid #ddd;">${data.email}</td></tr>
              <tr><td style="padding:8px; border:1px solid #ddd;">📞 <b>Telefon</b></td><td style="padding:8px; border:1px solid #ddd;">${data.telefon || '—'}</td></tr>
              <tr><td style="padding:8px; border:1px solid #ddd;">🚗 <b>Fahrzeug</b></td><td style="padding:8px; border:1px solid #ddd;">${data.kfzGutachten?.fahrzeugTyp || '—'} ${data.kfzGutachten?.marke || ''} ${data.kfzGutachten?.modell || ''}</td></tr>
              <tr><td style="padding:8px; border:1px solid #ddd;">📝 <b>Schadensart</b></td><td style="padding:8px; border:1px solid #ddd;">${data.kfzGutachten?.schadensart || '—'}</td></tr>
              <tr><td style="padding:8px; border:1px solid #ddd;">📝 <b>Schadensbeschreibung</b></td><td style="padding:8px; border:1px solid #ddd;">${data.kfzGutachten?.schadensbeschreibung || '—'}</td></tr>
              <tr><td style="padding:8px; border:1px solid #ddd;">📸 <b>Dokumente</b></td><td style="padding:8px; border:1px solid #ddd;">${validAttachments.length} Datei(en)</td></tr>
          </tbody>
        </table>
          <p style="margin-top:32px;">Eingegangen am: ${new Date().toLocaleString('de-DE')}</p>
      </div>
    `;
      // Mail an Rechtly
      await transporter.sendMail({
        from: smtpConfig.from,
        to: 'Anfragen@rechtly.de',
        subject: 'Neue Kfz-Gutachten-Anfrage',
        html: mailHtmlTeam,
        attachments
      });
      // Mail an Kunden
      await transporter.sendMail({
        from: smtpConfig.from,
        to: data.email,
        subject: '🚗 Ihre Kfz-Gutachten-Anfrage bei Rechtly',
        html: mailHtml,
        attachments
      });
      return true;
    } catch (error) {
      console.error('Fehler beim Senden der Kfz-Gutachten-E-Mails:', error);
      throw error;
    }
  }
}

function getVerkehrsunfallFormFields(data) {
  return [
    { label: 'Vorname', value: data.vorname },
    { label: 'Nachname', value: data.nachname },
    { label: 'E-Mail', value: data.email },
    { label: 'Telefon', value: data.telefon },
    { label: 'Straße', value: data.strasse },
    { label: 'PLZ', value: data.plz },
    { label: 'Ort', value: data.ort },
    { label: 'Unfallverursacher', value: data.unfallverursacher },
    { label: 'Unfalldatum', value: data.unfallDatum },
    { label: 'Unfallzeit', value: data.unfallZeit },
    { label: 'Unfallort', value: `${data.strasse}, ${data.plz} ${data.ort}` },
    { label: 'Weitere Angaben', value: data.weitereAngaben },
    { label: 'Unfallhergang', value: data.unfallhergang },
    { label: 'Reaktion', value: Object.entries(data.reaktion || {}).filter(([k,v])=>v).map(([k])=>k).join(', ') },
    { label: 'Verkehrszeichen', value: Object.entries(data.verkehrszeichen || {}).filter(([k,v])=>v).map(([k])=>k).join(', ') },
    { label: 'Fahrzeug', value: data.fahrzeugDetails ? `${data.fahrzeugDetails.markeModell || ''}, ${data.fahrzeugDetails.kennzeichen || ''}, ${data.fahrzeugDetails.farbe || ''}` : '' },
    { label: 'Erstzulassung', value: data.fahrzeugDetails?.erstzulassung },
    { label: 'Weitere Schäden', value: data.fahrzeugDetails?.weitereSchaeden },
    { label: 'Polizei verständigt', value: data.polizei?.verstaendigt },
    { label: 'Polizeibericht', value: (data.polizei?.polizeibericht && data.polizei.polizeibericht.length > 0) ? 'Ja' : 'Nein' },
    { label: 'Zeugen vorhanden', value: data.zeugen?.vorhanden },
    { label: 'Zeugendetails', value: data.zeugen?.details },
    { label: 'Personenschaden', value: data.personenschaden },
    { label: 'Rettungsdienst', value: data.rettungsdienst },
    { label: 'DSGVO-Einwilligung', value: data.dsgvoEinwilligung ? 'Ja' : 'Nein' },
    { label: 'Anwalt-Einwilligung', value: data.anwaltEinwilligung ? 'Ja' : 'Nein' },
  ];
}

function generateVerkehrsunfallPdf(data) {
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
    doc.fontSize(18).font('Helvetica-Bold').text('Verkehrsunfall-Anfrage Übersicht', { align: 'center' });
    doc.moveDown(1.5);

    // Tabelle
    const fields = getVerkehrsunfallFormFields(data);
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

function getKfzGutachtenFormFields(data) {
  return [
    { label: 'Vorname', value: data.vorname },
    { label: 'Nachname', value: data.nachname },
    { label: 'E-Mail', value: data.email },
    { label: 'Telefon', value: data.telefon },
    { label: 'Straße', value: data.strasse },
    { label: 'PLZ', value: data.plz },
    { label: 'Ort', value: data.ort },
    { label: 'Fahrzeugtyp', value: data.kfzGutachten?.fahrzeugTyp },
    { label: 'Marke', value: data.kfzGutachten?.marke },
    { label: 'Modell', value: data.kfzGutachten?.modell },
    { label: 'Baujahr', value: data.kfzGutachten?.baujahr },
    { label: 'Kennzeichen', value: data.kfzGutachten?.kennzeichen },
    { label: 'Schadensart', value: data.kfzGutachten?.schadensart },
    { label: 'Schadensbeschreibung', value: data.kfzGutachten?.schadensbeschreibung },
    { label: 'Versicherung', value: data.kfzGutachten?.versicherung?.name },
    { label: 'Versicherungsnummer', value: data.kfzGutachten?.versicherung?.versicherungsnummer },
    { label: 'DSGVO-Einwilligung', value: data.datenschutz ? 'Ja' : 'Nein' },
    { label: 'Anwalt-Einwilligung', value: data.anwaltEinwilligung ? 'Ja' : 'Nein' },
  ];
}

function generateKfzGutachtenPdf(data) {
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
    doc.fontSize(18).font('Helvetica-Bold').text('Kfz-Gutachten-Anfrage Übersicht', { align: 'center' });
    doc.moveDown(1.5);
    // Tabelle
    const fields = getKfzGutachtenFormFields(data);
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

module.exports = AnfrageEmailService; 