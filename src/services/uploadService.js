const multer = require('multer');
const { minioClient, BUCKET_NAME } = require('../config/config');
const Document = require('../models/Document');

// Multer Konfiguration für Memory Storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    // Erlaube nur Bilder und PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Nur Bilder und PDFs sind erlaubt'));
    }
  }
});

// Generiere eine eindeutige Anfrage-ID
const generateAnfrageId = () => {
  const now = new Date();
  return `REQ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
};

// Generiere einen sicheren Dateinamen
const generateSafeFilename = (originalname) => {
  const timestamp = Date.now();
  const extension = originalname.split('.').pop();
  const sanitizedName = originalname
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toLowerCase();
  return `${sanitizedName}-${timestamp}.${extension}`;
};

class UploadService {
  static getMulterUpload() {
    return upload.array('files');
  }

  static async handleUpload(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Keine Dateien zum Hochladen gefunden'
        });
      }

      const anfrageId = req.body.anfrageId || generateAnfrageId();
      const dokumentTyp = req.body.dokumentTyp || 'BUSSGELD'; // Standard ist BUSSGELD

      const uploadedFiles = [];

      for (const file of req.files) {
        const safeFilename = generateSafeFilename(file.originalname);
        const minioPath = `anfragen/${anfrageId}/${dokumentTyp}/${safeFilename}`;

        // Upload zu MinIO
        await minioClient.putObject(
          BUCKET_NAME,
          minioPath,
          file.buffer,
          {
            'Content-Type': file.mimetype,
            'Content-Length': file.size
          }
        );

        // Speichere Metadaten in MongoDB
        const document = new Document({
          anfrageId,
          art: dokumentTyp,
          kontakt: {
            name: req.body.name || '',
            email: req.body.email || '',
            telefon: req.body.telefon || ''
          },
          dokumente: [{
            typ: dokumentTyp,
            filename: safeFilename,
            pfad: minioPath,
            uploadDate: new Date()
          }]
        });

        await document.save();

        uploadedFiles.push({
          id: document._id,
          originalname: file.originalname,
          filename: safeFilename,
          path: minioPath,
          mimetype: file.mimetype,
          size: file.size
        });
      }

      return res.json({
        success: true,
        files: uploadedFiles,
        anfrageId
      });

    } catch (error) {
      console.error('Upload-Fehler:', error);
      return res.status(500).json({
        success: false,
        error: 'Fehler beim Hochladen der Dateien',
        details: error.message
      });
    }
  }

  static async deleteFile(fileId) {
    try {
      const document = await Document.findById(fileId);
      if (!document) {
        throw new Error('Dokument nicht gefunden');
      }

      // Lösche aus MinIO
      await minioClient.removeObject(BUCKET_NAME, document.dokumente[0].pfad);

      // Lösche aus MongoDB
      await Document.findByIdAndDelete(fileId);

      return true;
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      throw error;
    }
  }
}

module.exports = UploadService; 