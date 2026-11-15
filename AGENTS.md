# Mineflayer Control

## Project
Self-hosted Mineflayer control panel for Pterodactyl. The web panel, Mineflayer sessions, authentication, and persistent storage run in one Node.js process inside the Pterodactyl server.

## Runtime
- Node.js 22+
- TanStack Start + React
- Nitro Node server preset
- Mineflayer
- No Base44 SDK, Base44 backend, Cloudflare Worker, external runner, or remote database.

## Persistent data
DATA_DIR (default ./data) contains JSON storage:
- users.json: first owner account and password hash
- sessions.json: hashed session tokens and expiry
- bots.json: bot configuration and status
- commands.json: command records
- logs.json: bot console records
- microsoft/: Mineflayer Microsoft profile cache

Never commit data/ or environment secrets.

## Architecture
- src/lib/local-store.server.js: serialized, atomic JSON file operations.
- src/lib/auth.server.js: local first-owner registration, password hashing, sessions, cookies.
- src/lib/bot-manager.server.js: in-process Mineflayer lifecycle and commands.
- src/routes/api/local/$ .js: authenticated local API.
- src/api/localClient.js: browser adapter for /api/local/*.
- src/server.js: TanStack Start server entry and saved-bot resume.
- vite.config.js: TanStack Start + Nitro Node server build.

## Deployment
- Build: npm install && npm run build
- Start: npm start
- Pterodactyl port: SERVER_PORT is mapped to PORT by scripts/start.js.
- Bind address: 0.0.0.0.
- Persistent volume must retain DATA_DIR between restarts.

## Change rules
Preserve the existing black/minimal UI. Make the smallest necessary changes. Keep bot data private to its local owner. Validate all server-side input and ownership; never rely on hidden UI controls as authorization. Test npm run build when possible.
