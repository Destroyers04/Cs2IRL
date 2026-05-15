# CS2 Real-Life Bomb Defusal Simulator — Claude Context File

> This file is the single source of truth for Claude Code.
> Read this before touching any file. Follow it strictly.

---

## What This App Is

A real-life CS2 bomb defusal simulator for a private group of friends.
Players are assigned to teams (Terrorists or Counter-Terrorists) via an admin panel.
When the admin starts the match, one terrorist is randomly assigned the bomb — they don't know who has it until the match starts.
The terrorist plants the bomb via a directional arrow minigame on their phone.
Any alive CT can defuse it via the same minigame — but they must first enter the 4-digit plant code shown on the bomb carrier's screen.
Everything is real-time via Socket.io. Audio cues play on every phone for key events.

This is a private app. No public registration. ~6-10 users max. No sensitive data.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 (JSX) + Vite + Tailwind v4 |
| Routing | React Router v6 |
| Real-time | Socket.io client |
| HTTP client | Axios (JWT interceptor) |
| Backend | Node.js + Express (CommonJS, no TypeScript) |
| Real-time | Socket.io server |
| Database | SQLite via `better-sqlite3` |
| Auth | JWT (jsonwebtoken) + plaintext password compare |
| Process manager | PM2 |
| Hosting | DigitalOcean Droplet |
| Reverse proxy | Nginx |

**No TypeScript. No ORM. No bcrypt. No discord.js. No web push. No service workers.**

---

## Project Structure

```
cs2-bomb-sim/
├── CLAUDE.md
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                  ← React Router + global sound event listeners
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Lobby.jsx            ← all players, teams, alive status, match timer
│       │   ├── Admin.jsx            ← assign teams, randomize, configure match, start
│       │   ├── Match.jsx            ← role-aware match screen (live state)
│       │   ├── Bomb.jsx             ← bomb carrier: plant code display + countdown
│       │   ├── Plant.jsx            ← terrorist: arrow sequence minigame to plant
│       │   └── Defuse.jsx           ← CT: 4-digit code gate → arrow sequence to defuse
│       ├── components/
│       │   ├── SequenceGame.jsx     ← timer-based ↑↓←→ minigame (Lucide icons, strike system)
│       │   ├── BombTimer.jsx        ← live countdown display
│       │   ├── PlayerCard.jsx       ← single player row (name, team badge, alive/dead)
│       │   └── ProtectedRoute.jsx   ← redirects to /login if no JWT
│       └── lib/
│           ├── socket.js            ← Socket.io client singleton + connectSocket()
│           ├── api.js               ← Axios instance, attaches Bearer token
│           └── auth.js              ← getToken(), setToken(), clearToken(), getUser()
│
├── backend/
│   ├── package.json
│   ├── index.js                     ← Express + Socket.io entry point
│   ├── pm2.config.js                ← PM2 process config
│   ├── db/
│   │   ├── database.js              ← better-sqlite3 instance + init + migrations
│   │   └── schema.sql               ← table definitions + seed data
│   ├── routes/
│   │   ├── auth.js                  ← POST /api/auth/login
│   │   ├── match.js                 ← GET/POST/PATCH /api/match, start, reset
│   │   ├── admin.js                 ← assign-team, assign-bomb, randomize-teams, kill/revive
│   │   └── game.js                  ← plant/start, plant/complete, defuse/start, defuse/complete, mark-dead
│   ├── services/
│   │   └── gameService.js           ← state machine, timers, sequence gen, checkAllDeadWin
│   ├── middleware/
│   │   ├── auth.js                  ← verifyJWT, attaches req.user
│   │   └── adminOnly.js             ← 403 if req.user.is_admin !== 1
│   └── socket/
│       └── events.js                ← Socket.io server event handlers (player:join)
│
└── nginx/
    └── cs2sim.conf
```

---

## Database Schema (SQLite)

```sql
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,           -- plaintext, private app
  discord_id TEXT,
  is_admin   INTEGER DEFAULT 0,       -- 1 = admin
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS match (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  status                 TEXT DEFAULT 'lobby',
  -- lobby | active | planted | defused | exploded
  bomb_timer_seconds     INTEGER DEFAULT 40,
  plant_sequence_length  INTEGER DEFAULT 6,
  defuse_sequence_length INTEGER DEFAULT 6,
  max_plant_errors       INTEGER DEFAULT 3,
  max_defuse_errors      INTEGER DEFAULT 3,
  plant_timer_seconds    INTEGER DEFAULT 15,
  defuse_timer_seconds   INTEGER DEFAULT 10,
  arrow_time_seconds     REAL DEFAULT 2,
  match_length_seconds   INTEGER DEFAULT 120,
  match_end_time         TEXT,
  bomb_holder_id         INTEGER REFERENCES users(id),
  plant_start_time       TEXT,
  bomb_explode_time      TEXT,
  winner_team            TEXT,        -- 'ct' | 'terrorist'
  plant_code             TEXT,
  created_at             TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS match_players (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER REFERENCES match(id),
  user_id  INTEGER REFERENCES users(id),
  team     TEXT NOT NULL,             -- 'ct' | 'terrorist'
  is_alive INTEGER DEFAULT 1,
  UNIQUE(match_id, user_id)
);

CREATE TABLE IF NOT EXISTS sequence_attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id     INTEGER REFERENCES match(id),
  user_id      INTEGER REFERENCES users(id),
  type         TEXT,                  -- 'plant' | 'defuse'
  success      INTEGER,
  errors       INTEGER DEFAULT 0,
  attempted_at TEXT DEFAULT (datetime('now'))
);
```

### Seed users

```sql
INSERT OR IGNORE INTO users (username, password, is_admin) VALUES
  ('RamAnal',       '090811', 0),
  ('TehranToxic',   '240614', 0),
  ('CyaBald',       '260298', 0),
  ('Des04',         '211102', 1),
  ('Sjokoqueef',    '020702', 0),
  ('Dork3stfart3r', '170611', 0);
```

### database.js migrations
On startup, `database.js` runs `ALTER TABLE ADD COLUMN` (try/catch idempotent) for all new columns, and handles removing legacy columns (e.g. `defuser_holder_id`) via table recreation with `PRAGMA foreign_keys = OFF`.

---

## Auth

- `POST /api/auth/login` — body: `{ username, password }`
- Case-insensitive: `SELECT * FROM users WHERE LOWER(username) = LOWER(?)`
- On success: sign JWT with `{ id, username, is_admin }`, return `{ token }`
- Frontend stores token in `localStorage`, Axios attaches as `Authorization: Bearer <token>`
- No register route. No bcrypt. No refresh tokens.

---

## API Routes

### Auth
```
POST /api/auth/login          { username, password } → { token }
```

### Match
```
GET  /api/match               → full match state + all users with team/alive data
POST /api/match               → create new match (admin only), generates plant_code
PATCH /api/match/config       { bomb_timer_seconds, plant_sequence_length, defuse_sequence_length,
                                max_plant_errors, max_defuse_errors, plant_timer_seconds,
                                defuse_timer_seconds, arrow_time_seconds, match_length_seconds }
POST /api/match/start         → status='active', randomly assigns bomb_holder, starts match timer
POST /api/match/reset         → delete match, clear all timers
```

### Admin (all require JWT + is_admin=1)
```
POST /api/admin/assign-team       { user_id, team }          ← upserts into match_players
POST /api/admin/assign-bomb       { user_id }                ← manual bomb_holder override
POST /api/admin/randomize-teams   →  upserts ALL users into match_players with random teams
POST /api/admin/kill-player       { user_id }                ← triggers checkAllDeadWin
POST /api/admin/revive-player     { user_id }
```

### Game
```
POST /api/game/plant/start        → generates sequence (plant_sequence_length), stores in memory
POST /api/game/plant/complete     { errors } → sets status='planted', starts bomb timer, clears match timer
POST /api/game/defuse/start       → generates defuse sequence (any alive CT)
POST /api/game/defuse/complete    { errors } → sets status='defused', clears bomb timer
POST /api/game/mark-dead          → is_alive=0 for req.user, triggers checkAllDeadWin
```

---

## Game State Machine

```
lobby
  │ admin creates match (plant_code generated)
  │ admin assigns players to teams (or clicks Randomize Teams → upserts all users)
  │ admin configures timers, sequence lengths, error limits
  │ admin hits Start Match → redirected to lobby immediately
  │ server randomly assigns bomb_holder from terrorists (if not manually set)
  │ server sets match_end_time = now + match_length_seconds
  │ startMatchTimer() begins
  ▼
active
  │ bomb carrier sees "You have the bomb" on Lobby/Match
  │ bomb carrier navigates to /plant → auto-fetches sequence → minigame starts
  │ match timer counts down (if it expires without planting → CT win)
  │ if all CTs die → terrorists win (checkAllDeadWin)
  │ if all terrorists die → CT win (checkAllDeadWin)
  │ on plant complete → POST /api/game/plant/complete
  ▼
planted
  │ bomb_explode_time = now + bomb_timer_seconds
  │ match:planted emitted → bomb_planted.mp3 plays on ALL phones
  │ clearMatchTimer(), startBombTimer()
  │ CT navigates to /defuse
  │   → enters 4-digit plant code (shown on bomb carrier's /bomb page)
  │   → on correct code: fetches defuse sequence, minigame starts
  │   → defuse_start.mp3 plays on CT's phone only
  │ if all terrorists die → CT win (checkAllDeadWin)
  │ if all CTs die → terrorists win (checkAllDeadWin)
  │
  ├── defuse complete → POST /api/game/defuse/complete
  │     status='defused', winner_team='ct', clearBombTimer()
  │     match:defused emitted → defused_win.mp3 plays on ALL phones
  │
  └── bomb timer expires
        status='exploded', winner_team='terrorist'
        match:exploded emitted → explode_win.mp3 plays on ALL phones
```

### Win conditions
1. Bomb defused (CT completes sequence in time)
2. Bomb explodes (timer runs out)
3. Match timer expires without bomb planted → CT win (`status='defused'`)
4. All terrorists dead → CT win (`checkAllDeadWin`)
5. All CTs dead → terrorist win (`checkAllDeadWin`)

---

## Timers (gameService.js)

Two module-level timers:

```js
let bombTimeout = null;   // fires when bomb explodes
let matchTimeout = null;  // fires when round time expires without plant
```

- `startMatchTimer(matchId, seconds, io, db)` — called on match start. Only acts if status is still `'active'` when it fires (race condition guard). Emits `match:defused` on expiry.
- `clearMatchTimer()` — called when bomb is planted (bomb timer takes over) or match resets.
- `startBombTimer(matchId, seconds, io, db)` — called when plant completes.
- `clearBombTimer()` — called when defuse completes, checkAllDeadWin fires, or match resets.
- `checkAllDeadWin(matchId, io, db)` — called after every kill. Checks if all players on one team are dead. Only fires during `active` or `planted` status. Clears both timers if triggered.

---

## Socket.io Events

### Server → All Clients
| Event | Payload | When |
|---|---|---|
| `match:state` | full match object + players array | any state change |
| `match:planted` | `{ explode_at }` | bomb planted |
| `match:defused` | `{ winner: 'ct' }` | CT win (any cause) |
| `match:exploded` | `{ winner: 'terrorist' }` | terrorist win (any cause) |
| `match:started` | match state | admin starts match |
| `game:notification` | `{ title, body }` | key events (match start, planted, defused, exploded) |

### Client → Server
| Event | Payload | When |
|---|---|---|
| `player:join` | `{ token }` | on connect + every reconnect |

`player:join` is idempotent — server re-registers socket and sends current `match:state`.

### State updates — no polling
Every backend action that changes state emits `match:state` via socket. All pages listen to `match:state` and update reactively. No page calls `fetchMatch()` after its own actions (except initial load).

---

## Sounds (App.jsx — global, plays on every phone)

All key event sounds are registered once in `App.jsx` so they fire regardless of which page the user is on:

| Event | Sound file |
|---|---|
| `match:planted` | `bomb_planted.mp3` |
| `match:defused` | `defused_win.mp3` |
| `match:exploded` | `explode_win.mp3` |

Local-only sounds (play only on the acting player's device):

| Trigger | Sound file |
|---|---|
| Plant sequence starts | `plant_start.mp3` |
| Defuse sequence starts | `defuse_start.mp3` |

All files in `frontend/public/sounds/`.

---

## SequenceGame Component

Timer-based directional minigame used in Plant and Defuse.

```jsx
<SequenceGame
  sequence={['up', 'down', 'left', 'right', ...]}
  duration={15}          // main countdown in seconds — onComplete fires when it hits 0
  arrowTime={2}          // per-arrow timeout in seconds — onFail fires if no input
  maxErrors={3}          // wrong presses allowed before onFail
  onComplete={() => {}}  // called when main timer expires (success)
  onFail={() => {}}      // called on maxErrors exceeded OR arrow timeout
/>
```

### Behaviour
- Arrow buttons and current-arrow indicator use Lucide React icons (`ArrowUp/Down/Left/Right`)
- Main countdown bar + MM:SS display
- Per-arrow countdown bar (resets on each correct/wrong press)
- Strike indicators: filled red dots for each error (up to maxErrors)
- Correct press → advance step, restart arrow timer
- Wrong press → strike++, reset to step 0, restart arrow timer. If strikes >= maxErrors → `onFail()`
- Arrow timer expires → `onFail()` immediately (red flash + shake)
- Main timer hits 0 → `onComplete()` (success regardless of step position)

### Plant flow (Plant.jsx)
- Navigating to `/plant` auto-fetches sequence and starts immediately (no button tap needed)
- `plant_start.mp3` plays locally
- `onComplete` → POST `/api/game/plant/complete { errors: 0 }` → navigate to `/bomb`
- `onFail` → back to idle phase, show "Try again" button

### Defuse flow (Defuse.jsx)
1. CT taps "Start defusing" → code entry phase
2. CT enters 4-digit `plant_code` (shown on bomb carrier's `/bomb` screen)
3. Wrong code → error, clear digits, refocus
4. Correct code → fetch sequence, `defuse_start.mp3` plays, minigame starts
5. `onComplete` → POST `/api/game/defuse/complete { errors: 0 }` → success screen → `/lobby` after 3s
6. `onFail` → back to idle, "Try again" button (code must be re-entered)

---

## Frontend Pages

### `/login`
Username + password → JWT → redirect to `/lobby`

### `/lobby`
- All players with team badge and alive/dead status
- Match status banner with BombTimer when active or planted
- Admin button (is_admin only) → `/admin`
- "Plant bomb" button for bomb holder when active
- "Defuse bomb" button for alive CTs when planted
- "Mark as dead" button with confirmation modal

### `/admin`
- Randomize Teams button (orange) — upserts all users into match_players with random teams
- Per-player team select dropdowns
- Match config: match length, bomb timer, plant time, defuse time, arrow time, plant sequence length, defuse sequence length, max plant errors, max defuse errors
- Save config shows toast "Config saved" for 2.5s
- Start Match → redirects admin to `/lobby` immediately
- Reset Match button (with confirm dialog)

### `/match`
- Round timer when active, bomb timer when planted
- "Go plant" button for bomb holder when active
- "Defuse now" button for alive CTs when planted
- "Mark myself as dead" button
- Player list

### `/bomb`
- Only accessible to bomb_holder_id
- When `active` → redirects to `/plant`
- When `planted` → shows plant code large, bomb countdown timer
- Lobby button only appears after match ends (defused/exploded)

### `/plant`
- Auto-starts on mount (fetches sequence immediately)
- On fail → idle with "Try again" button

### `/defuse`
- idle → code entry → playing → success

---

## Plant Code

- 4-digit numeric code generated server-side on match creation (`Math.floor(1000 + Math.random() * 9000)`)
- Stored in `match.plant_code`, returned in `GET /api/match`
- Displayed large on `/bomb` for the bomb carrier to show to nearby CTs
- CT must enter this code on `/defuse` before the sequence game starts
- Code check is client-side (both sides have the match state)

---

## Reconnection

```js
// lib/socket.js
const socket = io({ autoConnect: false, reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000 });

export function connectSocket(token) {
  socket.connect();
  socket.on('connect', () => socket.emit('player:join', { token }));
}
```

`player:join` is re-emitted on every reconnect. Server sends current `match:state` back to the reconnected socket.

---

## Deployment

### Server: DigitalOcean Droplet (Ubuntu 24.04)
- IP: `188.166.95.26`
- Domain: `cs2irl.aaronmale.me` (A record on Porkbun → droplet IP)
- Do NOT touch `aaronmale.me` root (separate Vercel portfolio)

### Deploy steps
```bash
# Local: build frontend
cd frontend && npm run build

# Local: SCP to droplet
scp -r frontend/dist root@188.166.95.26:/var/www/cs2sim/frontend/
scp -r backend root@188.166.95.26:/var/www/cs2sim/

# On server
cd /var/www/cs2sim/backend
npm install --omit=dev
echo "JWT_SECRET=<random string>" > .env
echo "PORT=3001" >> .env
pm2 start pm2.config.js
pm2 save && pm2 startup
```

### Nginx (`/etc/nginx/sites-available/cs2sim`)
```nginx
server {
  listen 80;
  server_name cs2irl.aaronmale.me;

  location / {
    root /var/www/cs2sim/frontend/dist;
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
  }

  location /socket.io/ {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
  }
}
```

```bash
ln -s /etc/nginx/sites-available/cs2sim /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d cs2irl.aaronmale.me
```

### PM2 config (`backend/pm2.config.js`)
```js
module.exports = {
  apps: [{
    name: 'cs2-api',
    script: './index.js',
    cwd: '/var/www/cs2sim/backend',
    env: { NODE_ENV: 'production', PORT: 3001 },
  }],
};
```

---

## What Is NOT in this app

- GPS-locked planting
- Multiple rounds / round history / scoreboard
- Kit mechanic
- Spectator mode
- Player stats
- Registration / email / OAuth
- Web push / service workers / VAPID
- Discord webhook
- Defuser holder mechanic (any alive CT can defuse)
