require('dotenv').config();

const config = {
  // Server Konfiguration
  server: {
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV || 'development'
  },

  // MongoDB Konfiguration
  mongodb: {
    uri: process.env.MONGODB_URI
  },

  // JWT Konfiguration
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '24h'
  },

  // E-Mail Konfiguration
  email: {
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    from: process.env.EMAIL_FROM || 'noreply@rechtly.de'
  },

  // Support Konfiguration
  support: {
    phone: process.env.SUPPORT_PHONE || '+49 123 456789',
    email: process.env.SUPPORT_EMAIL || 'anfragen@rechtly.de'
  },

  // Domain Konfiguration
  domains: {
    base: process.env.NODE_ENV === 'production' ? 'https://rechtly.de' : 'http://localhost:3000',
    mandant: process.env.NODE_ENV === 'production' ? 'https://mandant.rechtly.de' : 'http://localhost:3000',
    anwalt: process.env.NODE_ENV === 'production' ? 'https://anwalt.rechtly.de' : 'http://localhost:3000',
    gutachter: process.env.NODE_ENV === 'production' ? 'https://gutachter.rechtly.de' : 'http://localhost:3000'
  },

  // Frontend URLs
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

const Minio = require('minio');

// Debug: Überprüfe MinIO Umgebungsvariablen
console.log('MinIO Konfiguration:', {
  endpoint: process.env.MINIO_ENDPOINT,
  port: process.env.MINIO_PORT,
  useSSL: process.env.MINIO_USE_SSL,
  bucket: process.env.MINIO_BUCKET,
  user: process.env.MINIO_ROOT_USER ? 'Vorhanden' : 'Fehlt',
  password: process.env.MINIO_ROOT_PASSWORD ? 'Vorhanden' : 'Fehlt',
  publicUrl: process.env.MINIO_PUBLIC_URL
});

// Extrahiere den Hostnamen aus der URL
const getHostname = (url) => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    console.error('Fehler beim Parsen des MinIO-Endpoints:', error);
    return url;
  }
};

const minioClient = new Minio.Client({
  endPoint: getHostname(process.env.MINIO_ENDPOINT),
  port: parseInt(process.env.MINIO_PORT),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ROOT_USER,
  secretKey: process.env.MINIO_ROOT_PASSWORD
});

const BUCKET_NAME = process.env.MINIO_BUCKET;

// Stelle sicher, dass der Bucket existiert
const ensureBucket = async () => {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME);
      console.log(`Bucket ${BUCKET_NAME} wurde erstellt`);
    }
  } catch (error) {
    console.error('Fehler beim Erstellen des Buckets:', error);
    throw error;
  }
};

// Initialisiere den Bucket beim Start
ensureBucket().catch(console.error);

module.exports = {
  ...config,
  minioClient,
  BUCKET_NAME,
  MINIO_PUBLIC_URL: process.env.MINIO_PUBLIC_URL
}; 