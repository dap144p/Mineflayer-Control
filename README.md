# Mineflayer Control

Mineflayer Control is a self-hosted Mineflayer web panel. The web app, Mineflayer bots, authentication, and persistent data all run inside your own Node.js server on Pterodactyl. It does not require Base44, a Base44 API key, or an external runner.

## Requirements

- Pterodactyl server with Node.js 22 or newer
- At least one allocated server port
- Outbound network access to the Minecraft servers the bots connect to

## Deploy on Pterodactyl

1. Create a Node.js server in your Pterodactyl panel and allocate a port.
2. Download this repository into the server files (or use the panel's Git deployment feature).
3. Use Node.js 22 or newer.
4. Set the startup command to:

   \`npm install && npm run build && npm start\`

   For later restarts, use \`npm start\` after the dependencies and build are already present.
5. Open the allocated port through your panel's domain/proxy.

The app reads \`SERVER_PORT\` automatically when \`PORT\` is not set and binds to \`0.0.0.0\`.

## First login

Open the website. On the first visit, select **Buat akun owner pertama** and create the owner account. Registration closes automatically after the first account is created.

Use a long, unique password. Sessions are stored locally and the login cookie is HttpOnly.

## Local storage

All persistent data is created under \`data/\` in the server's working directory:

- \`users.json\` — local owner account and password hash
- \`sessions.json\` — active login sessions
- \`bots.json\` — bot configuration and status
- \`commands.json\` — command history
- \`logs.json\` — bot console logs
- \`microsoft/\` — Microsoft authentication profile cache, when used

Set \`DATA_DIR\` to another persistent directory when needed. Back up this folder before reinstalling or deleting the Pterodactyl server. Do not commit it to GitHub.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| \`SERVER_PORT\` | Pterodactyl allocation | Pterodactyl's allocated port |
| \`PORT\` | \`SERVER_PORT\` or \`3000\` | HTTP listening port |
| \`HOST\` | \`0.0.0.0\` | Bind address |
| \`DATA_DIR\` | \`./data\` | Persistent local data folder |
| \`MAX_BOTS\` | \`10\` | Maximum simultaneous Mineflayer sessions |
| \`COOKIE_SECURE\` | \`false\` | Set \`true\` when the public panel uses HTTPS |

## Notes

- Bots run in the same Node.js process as the panel. Keep the Pterodactyl server online to keep them connected.
- Bots configured as running are resumed after the panel process restarts.
- Microsoft sign-in tokens are stored in \`data/microsoft/\`.
- The panel does not control or start another Pterodactyl server. It uses the resources assigned to this one.
