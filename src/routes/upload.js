const express = require('express');
const router = express.Router();
const UploadService = require('../services/uploadService');

// Middleware für Datei-Upload
const uploadMiddleware = UploadService.getMulterUpload();

// POST /api/upload - Dateien hochladen
router.post('/', uploadMiddleware, async (req, res) => {
  try {
    const result = await UploadService.handleUpload(req, res);
    return result;
  } catch (error) {
    console.error('Upload-Route Fehler:', error);
    return res.status(500).json({
      success: false,
      error: 'Fehler beim Upload',
      details: error.message
    });
  }
});

// DELETE /api/upload/:fileId - Datei löschen
router.delete('/:fileId', async (req, res) => {
  try {
    await UploadService.deleteFile(req.params.fileId);
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete-Route Fehler:', error);
    return res.status(500).json({
      success: false,
      error: 'Fehler beim Löschen',
      details: error.message
    });
  }
});

module.exports = router; 