const jwt = require('jsonwebtoken');
const config = require('../config/config');
const logger = require('../utils/logger');

const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Kein Authentifizierungstoken vorhanden' });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Authentifizierungsfehler:', error);
    res.status(401).json({ message: 'Ungültiger Token' });
  }
};

const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Nicht authentifiziert' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Keine Berechtigung für diese Aktion' });
    }

    next();
  };
};

module.exports = {
  auth,
  checkRole
}; 