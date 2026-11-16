# Mineflayer Control

Mineflayer Control is a self-hosted Mineflayer web panel. The web app, Mineflayer bots, authentication, and persistent data all run inside your own Node.js server on Pterodactyl. It does not require Base44, a Base44 API key, or an external runner.

## Requirements

- Pterodactyl server with Node.js 22 or newer
- At least one allocated server port
- Outbound network access to the Minecraft servers the bots connect to

## Deploy on Pterodactyl

1. Create a Node.js server in your Pterodactyl panel and allocate a port.
2. Download this repository into the server files (or use the panel's Git deployment feature).
3. Select Node.js 22 or newer in the server's startup environment.
4. In the Pterodactyl Console, install and build the project once:

   npm install
   npm run build

5. Set the Pterodactyl startup command to:

   npm start

6. Open the allocated port through your panel's domain/proxy.

Run npm run build again after pulling source-code updates. Normal restarts only need npm start.

The startup wrapper maps Pterodactyl's SERVER_PORT to PORT and binds the server to 0.0.0.0.

## Runner modes

Mineflayer Control supports three runner modes:

- **Local Runner** — bot processes run in this website's Node.js process. The maximum is controlled by `MAX_BOTS`.
- **VPS Runner** — add a VPS runner, download its generated `runner.mjs`, install `mineflayer`, and keep `node runner.mjs` running on the VPS.
- **Pterodactyl Runner** — add the panel URL and a **Client API Key** (Account → API Credentials), select the target server, then install the generated `runner.mjs` on that server and set its startup command to `node runner.mjs`. Mineflayer Control uses the Client API Key to list the account's servers, check resource state, and send power signals; the runner script itself executes the bots.

VPS and Pterodactyl runner processes connect back to `/api/runner/sync` using their generated runner token. Keep that token private. Panel API keys are stored in the local `data/runners.json` file and are not returned to the browser. The `data/` directory is excluded from Git.

Bots are assigned to available external runners first, then to Local Runner. If all available runner slots are full, bots remain queued until a slot becomes available. Each external runner's `max bot` setting controls its assigned bot capacity.

## First login

Open the website. On the first visit, select **Buat akun owner pertama** and create the owner account. Registration closes automatically after the first account is created.

Use a long, unique password. Sessions are stored locally and the login cookie is HttpOnly.

## Local storage

All persistent data is created under data/ in the server's working directory:

- users.json — local owner account and password hash
- sessions.json — active login sessions
- bots.json — bot configuration and status
- commands.json — command history
- logs.json — bot console logs
- microsoft/ — Microsoft authentication profile cache, when used

Set DATA_DIR to another persistent directory when needed. Back up this folder before reinstalling or deleting the Pterodactyl server. Do not commit it to GitHub.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| SERVER_PORT | Pterodactyl allocation | Pterodactyl's allocated port |
| PORT | SERVER_PORT or 3000 | HTTP listening port |
| HOST | 0.0.0.0 | Bind address |
| DATA_DIR | ./data | Persistent local data folder |
| MAX_BOTS | 10 | Maximum simultaneous Mineflayer sessions |
| COOKIE_SECURE | false | Set true when the public panel uses HTTPS |

## Notes

- Bots run in the same Node.js process as the panel. Keep the Pterodactyl server online to keep them connected.
- Bots configured as running are resumed after the panel process restarts.
- Microsoft sign-in tokens are stored in data/microsoft/.
- The panel does not control or start another Pterodactyl server. It uses the resources assigned to this one.
