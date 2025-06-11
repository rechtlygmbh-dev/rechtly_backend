const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

// Express App initialisieren
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS-Konfiguration
app.use(cors({
  origin: 'http://localhost:3000', // ggf. an deine Frontend-URL anpassen
  credentials: true
}));

// Statische Dateien
app.use('/assets', express.static(path.join(__dirname, '../public/assets')));

// Routes
const anfrageRoute = require('./routes/anfrage');
app.use('/api/anfrage', anfrageRoute);

const uploadRoute = require('./routes/uploads');
app.use('/api/upload', uploadRoute);

app.get('/test', (req, res) => {
  res.json({ message: 'Server läuft!' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal Server Error',
    details: err.message 
  });
});

// Server starten
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
  console.log('Umgebungsvariablen:', {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER
  });
});

// Unhandled Rejection Handler
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// Uncaught Exception Handler
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
}); 