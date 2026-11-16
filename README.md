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
4. Set the Pterodactyl startup command to:

   `node index.js`

5. Save the setting and start the server. The entrypoint automatically installs or updates dependencies when needed, builds the web panel when source files change, then starts the website. The first startup may take longer while dependencies are installed and the initial build runs.
6. Open the allocated port through your panel's domain/proxy.

Keep the startup command as `node index.js` for every restart. After pulling source-code updates, start the server again; the entrypoint checks the source and rebuilds when needed.

The entrypoint maps Pterodactyl's `SERVER_PORT` to `PORT` and binds the server to `0.0.0.0`.

## Add and start a bot

1. Open **Tambah bot** from the dashboard.
2. Enter the Minecraft server address, port, username, and game version. Leave the version blank or use `auto` for automatic protocol selection.
3. The display name is optional. When blank, the username is used as the bot name.
4. Choose the authentication mode supported by the target server: **offline** or **Microsoft**.
5. Press **Simpan**. The bot is saved with its state set to stopped.
6. Press the bot's **Jalankan / Power** button. Mineflayer Control assigns an available runner and starts the connection.
7. Watch the bot status and console. The status becomes **online** after the bot has spawned into the Minecraft world.

Use the bot detail page for web controls: chat, server commands, directional movement, jump, and stop. Movement buttons currently send a short movement input; the stop button clears active controls.

A successful login depends on the target server's version, authentication mode, network availability, and server access policy. The panel does not bypass server admission or anti-bot checks.

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

All persistent data is created under `data/` in the server's working directory:

- `users.json` — local owner account and password hash
- `sessions.json` — active login sessions
- `bots.json` — bot configuration and status
- `commands.json` — command history
- `logs.json` — bot console logs
- `microsoft/` — Microsoft authentication profile cache, when used

Set `DATA_DIR` to another persistent directory when needed. Back up this folder before reinstalling or deleting the Pterodactyl server. Do not commit it to GitHub.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| SERVER_PORT | Pterodactyl allocation | Pterodactyl's allocated port |
| PORT | SERVER_PORT or 3000 | HTTP listening port |
| HOST | 0.0.0.0 | Bind address |
| DATA_DIR | ./data | Persistent data folder |
| MAX_BOTS | 10 | Maximum simultaneous Mineflayer sessions |
| COOKIE_SECURE | false | Set true when the public panel uses HTTPS |

## Notes

- Bots run in the same Node.js process as the panel. Keep the Pterodactyl server online to keep them connected.
- Bots configured as running are resumed after the panel process restarts.
- Microsoft sign-in tokens are stored in `data/microsoft/`.
- The panel does not control or start another Pterodactyl server. It uses the resources assigned to this one.
