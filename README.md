# Rechtly Server

Backend-Server für die Rechtly-Anwendung mit Authentifizierung, Benutzerverwaltung und E-Mail-Funktionalität.

## Funktionen

- Benutzerregistrierung und -authentifizierung
- E-Mail-Aktivierung für neue Konten
- Passwort-Reset-Funktionalität
- JWT-basierte Authentifizierung
- Rollenbasierte Zugriffskontrolle
- E-Mail-Benachrichtigungen
- Logging und Fehlerbehandlung

## Voraussetzungen

- Node.js (v14 oder höher)
- MongoDB
- SMTP-Server für E-Mail-Funktionalität

## Installation

1. Repository klonen
2. In das Server-Verzeichnis wechseln:
   ```bash
   cd rechtly/server
   ```
3. Abhängigkeiten installieren:
   ```bash
   npm install
   ```
4. Umgebungsvariablen konfigurieren:
   - Kopiere `.env.example` zu `.env`
   - Passe die Werte in `.env` an

## Konfiguration

Die folgenden Umgebungsvariablen müssen in der `.env`-Datei konfiguriert werden:

- `PORT`: Server-Port (Standard: 5000)
- `MONGODB_URI`: MongoDB-Verbindungs-URI
- `JWT_SECRET`: Geheimer Schlüssel für JWT
- `JWT_EXPIRES_IN`: JWT-Ablaufzeit
- `SMTP_*`: SMTP-Server-Konfiguration
- `EMAIL_FROM`: Absender-E-Mail-Adresse
- `*_DOMAIN`: Domain-Konfigurationen

## Entwicklung

Server im Entwicklungsmodus starten:
```bash
npm run dev
```

## Produktion

Server im Produktionsmodus starten:
```bash
npm start
```

## API-Endpunkte

### Authentifizierung

- `POST /api/auth/register` - Benutzerregistrierung
- `GET /api/auth/activate/:token` - Kontoaktivierung
- `POST /api/auth/login` - Benutzeranmeldung
- `POST /api/auth/forgot-password` - Passwort-Reset anfordern
- `POST /api/auth/reset-password/:token` - Passwort zurücksetzen

## Sicherheit

- Helmet für Sicherheits-Header
- CORS-Konfiguration
- JWT-Authentifizierung
- Passwort-Hashing mit bcrypt
- E-Mail-Validierung
- Rate-Limiting (in Planung)

## Tests

Tests ausführen:
```bash
npm test
```

## Lizenz

Proprietär - Alle Rechte vorbehalten 