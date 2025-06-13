const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/config');
const logger = require('./utils/logger');

// Routen importieren
const authRoutes = require('./routes/auth');
const faqContactRoute = require('./routes/faqContact');
const kfzGutachtenRouter = require('./routes/kfzGutachten');
const bussgeldRouter = require('./routes/bussgeld');

// Express-App erstellen
const app = express();

// Middleware
app.use(helmet()); // Sicherheits-Header
app.use(cors()); // CORS-Unterstützung
app.use(express.json()); // JSON-Parser
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } })); // Logging

// Datenbankverbindung
mongoose.connect(config.MONGODB_URI)
  .then(() => {
    logger.info('MongoDB verbunden');
  })
  .catch((error) => {
    logger.error('MongoDB Verbindungsfehler:', error);
    process.exit(1);
  });

// Routen
app.use('/api/auth', authRoutes);
app.use('/api/upload', require('./routes/upload'));
app.use('/api/faq-contact', faqContactRoute);
app.use('/api/anfrage/verkehrsunfall', require('./routes/verkehrsunfall'));
app.use('/api/anfrage/bussgeld', bussgeldRouter);
app.use('/api/anfrage/kfz-gutachten', kfzGutachtenRouter);

// Fehlerbehandlung
app.use((err, req, res, next) => {
  logger.error('Server-Fehler:', err);
  res.status(500).json({ message: 'Interner Server-Fehler' });
});

// Server starten
const PORT = config.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Server läuft auf Port ${PORT}`);
});

module.exports = app; 