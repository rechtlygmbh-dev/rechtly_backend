const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Upload-Verzeichnis erstellen, falls nicht vorhanden
const uploadDir = path.join(__dirname, '../../uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('Upload-Verzeichnis erstellt:', uploadDir);
  }
} catch (error) {
  console.error('Fehler beim Erstellen des Upload-Verzeichnisses:', error);
}

// Erlaubte Dateitypen
const allowedFileTypes = ['application/pdf', 'image/jpeg', 'image/png'];
const maxFileSize = 5 * 1024 * 1024; // 5MB

// Multer Konfiguration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    try {
      // Sicheres Dateinamen-Format
      const safeFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const finalFileName = unique + '-' + safeFileName;
      console.log('Neuer Dateiname:', finalFileName);
      cb(null, finalFileName);
    } catch (error) {
      cb(error);
    }
  }
});

// Datei-Filter
const fileFilter = (req, file, cb) => {
  console.log('Datei-Typ:', file.mimetype);
  if (allowedFileTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Nicht erlaubter Dateityp. Nur PDF, JPG und PNG sind erlaubt.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: maxFileSize,
    files: 5 // Maximal 5 Dateien pro Upload
  }
});

// Upload-Route mit Fehlerbehandlung
router.post('/', (req, res) => {
  console.log('Upload-Anfrage erhalten');
  upload.array('files')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer Fehler:', err);
      // Multer-spezifische Fehler
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'Datei zu groß',
          details: 'Die maximale Dateigröße beträgt 5MB'
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          error: 'Zu viele Dateien',
          details: 'Maximal 5 Dateien pro Upload erlaubt'
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Upload-Fehler',
        details: err.message
      });
    } else if (err) {
      console.error('Allgemeiner Upload-Fehler:', err);
      // Andere Fehler
      return res.status(400).json({
        success: false,
        error: 'Upload-Fehler',
        details: err.message
      });
    }

    // Erfolgreicher Upload
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Keine Dateien hochgeladen',
          details: 'Bitte wählen Sie mindestens eine Datei aus'
        });
      }

      const fileNames = req.files.map(f => f.filename);
      console.log('Erfolgreich hochgeladene Dateien:', fileNames);
      res.json({
        success: true,
        files: fileNames
      });
    } catch (error) {
      console.error('Fehler bei der Verarbeitung der Uploads:', error);
      res.status(500).json({
        success: false,
        error: 'Server-Fehler',
        details: 'Fehler bei der Verarbeitung der Uploads'
      });
    }
  });
});

module.exports = router;