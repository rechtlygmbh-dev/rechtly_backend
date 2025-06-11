require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bussgeldRoutes = require('./src/routes/bussgeld');
const anfrageRoutes = require('./src/routes/anfrage');
const uploadRoutes = require('./src/routes/upload');
const { minioClient, BUCKET_NAME } = require('./src/config/config');

const app = express();

// Debug: Überprüfe Umgebungsvariablen
console.log('Umgebungsvariablen:', {
  MONGODB_URI: process.env.MONGODB_URI ? 'Vorhanden' : 'Fehlt',
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT ? 'Vorhanden' : 'Fehlt',
  MINIO_PORT: process.env.MINIO_PORT ? 'Vorhanden' : 'Fehlt',
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY ? 'Vorhanden' : 'Fehlt',
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY ? 'Vorhanden' : 'Fehlt',
  MINIO_BUCKET_NAME: process.env.MINIO_BUCKET_NAME ? 'Vorhanden' : 'Fehlt'
});

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Verbindung
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI ist nicht in den Umgebungsvariablen definiert');
  process.exit(1);
}

// Debug: Zeige MongoDB URI (ohne Passwort)
const debugUri = MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
console.log('Versuche Verbindung zu MongoDB:', debugUri);

// MinIO Verbindung testen
const testMinioConnection = async () => {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    console.log('MinIO Verbindung erfolgreich hergestellt');
    console.log(`Bucket "${BUCKET_NAME}" ${exists ? 'existiert bereits' : 'wurde erstellt'}`);
    return true;
  } catch (error) {
    console.error('MinIO Verbindungsfehler:', error);
    return false;
  }
};

// Server starten
const startServer = async () => {
  try {
    // MongoDB verbinden
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority',
      dbName: 'rechtly'
    });
    console.log('MongoDB erfolgreich verbunden');
    console.log('Verbundene Datenbank:', mongoose.connection.db.databaseName);

    // MinIO verbinden
    const minioConnected = await testMinioConnection();
    if (!minioConnected) {
      console.error('Server wird trotz MinIO-Fehler gestartet...');
    }

    // Routes
    app.use('/api/bussgeld', bussgeldRoutes);
    app.use('/api/anfrage', anfrageRoutes);
    app.use('/api/upload', uploadRoutes);

    // Statische Dateien
    app.use(express.static(path.join(__dirname, '../build')));
    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

    // Catch-all Route für React App
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../build/index.html'));
    });

    // Error Handler
    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({
        success: false,
        message: 'Ein Fehler ist aufgetreten',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server läuft auf Port ${PORT}`);
      console.log('Server-Status:');
      console.log('✓ MongoDB: Verbunden');
      console.log(`✓ MinIO: ${minioConnected ? 'Verbunden' : 'Nicht verbunden'}`);
    });
  } catch (error) {
    console.error('Fehler beim Serverstart:', error);
    process.exit(1);
  }
};

startServer(); 