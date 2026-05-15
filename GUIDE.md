# CS2 Bomb Sim — Full Guide
> No AI needed. Everything you need to debug, style, and extend the app is in here.

---

## TODO List

### 🔴 Must do before the game (tomorrow)
- [ ] Add real friend usernames to the database (see DEPLOY.md → Adding Users)
- [ ] Build frontend: `npm run build` in the frontend folder
- [ ] Upload code to server via scp (see DEPLOY.md → Upload to server)
- [ ] Install Node + Nginx + PM2 on server (see DEPLOY.md → On the server)
- [ ] Create `.env` on server with real JWT_SECRET
- [ ] Set up Nginx config + enable it
- [ ] Start backend with PM2
- [ ] Get SSL cert via Certbot
- [ ] Test full round on phones before friends arrive

### 🟡 Nice to have (do when you have AI again)
- [ ] Fix the 1-2 second loading delay (see "Why Pages Show LOADING" section — match cache fix)
- [ ] Add numpad to login page so no keyboard needed (see "Adding a Numpad" section)
- [ ] Add username picker to login (tap your name instead of typing)
- [ ] Test on iPhone specifically — must use Add to Home Screen flow

### 🟢 Future improvements (not urgent)
- [ ] Style improvements with shadcn (see "Adding shadcn/ui" section)
- [ ] Make variable names more readable (rename agent ran — verify it didn't break anything)
- [ ] Add more sounds (round start, etc.)
- [ ] Test what happens when phone screen locks mid-game (socket should reconnect)

---

## Adding a Numpad to the Login Page

On mobile, typing a username and password on the keyboard is clunky. This guide replaces the password field with a visual PIN numpad — big buttons, thumb-friendly, no keyboard popup.

### What it looks like
```
[ 1 ] [ 2 ] [ 3 ]
[ 4 ] [ 5 ] [ 6 ]
[ 7 ] [ 8 ] [ 9 ]
[ ⌫ ] [ 0 ] [ ✓ ]
```
The password dots appear above as the player taps. No keyboard ever opens.

---

### Step 1 — Create the Numpad component

Create a new file: `frontend/src/components/Numpad.jsx`

```jsx
import { useState } from 'react';

export default function Numpad({ onConfirm }) {
  const [value, setValue] = useState('');

  function press(key) {
    if (key === 'del') {
      setValue(v => v.slice(0, -1));
    } else if (key === 'confirm') {
      if (value.length > 0) onConfirm(value);
    } else {
      if (value.length < 12) setValue(v => v + key);
    }
  }

  const buttons = ['1','2','3','4','5','6','7','8','9','del','0','confirm'];

  return (
    <div className="flex flex-col items-center gap-3">
      {/* PIN dots display */}
      <div className="flex gap-3 py-3 min-h-[40px]">
        {value.length === 0 ? (
          <span className="text-gray-600 font-mono tracking-widest text-sm">ENTER PASSWORD</span>
        ) : (
          value.split('').map((_, i) => (
            <div
              key={i}
              style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#f97316' }}
            />
          ))
        )}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%' }}>
        {buttons.map(btn => (
          <button
            key={btn}
            type="button"
            onClick={() => press(btn)}
            style={{
              height: 72,
              backgroundColor: btn === 'confirm' ? '#f97316' : btn === 'del' ? '#374151' : '#1a1a1a',
              color: btn === 'confirm' ? '#0a0a0a' : '#f1f1f1',
              border: '1px solid #374151',
              fontSize: btn === 'confirm' || btn === 'del' ? 22 : 26,
              fontFamily: 'Courier New, monospace',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            {btn === 'del' ? '⌫' : btn === 'confirm' ? '✓' : btn}
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

### Step 2 — Use it in Login.jsx

Open `frontend/src/pages/Login.jsx` and make these changes:

**At the top, add the import:**
```jsx
import Numpad from '../components/Numpad';
```

**Replace the password `<input>` block with the Numpad:**

Find this block (around line 78):
```jsx
<div className="flex flex-col gap-1">
  <label htmlFor="password" ...>Password</label>
  <input id="password" type="password" ... />
</div>
```

Replace the entire block with:
```jsx
<div className="flex flex-col gap-1">
  <label
    className="text-xs font-mono tracking-widest uppercase"
    style={{ color: '#9ca3af' }}
  >
    Password
  </label>
  <Numpad onConfirm={(pin) => {
    setPassword(pin);
    // auto-submit when they hit confirm
    handleSubmitWithPassword(pin);
  }} />
</div>
```

**Add a helper function** right above `handleSubmit`:
```jsx
async function handleSubmitWithPassword(pin) {
  if (!username.trim() || !pin) return;
  setError('');
  setLoading(true);
  try {
    const res = await api.post('/auth/login', { username: username.trim(), password: pin });
    setToken(res.data.token);
    connectSocket(res.data.token);
    navigate('/lobby');
  } catch (err) {
    setError(err.response?.data?.error || 'Login failed. Check credentials.');
  } finally {
    setLoading(false);
  }
}
```

**Also remove the submit button** (the LOGIN button at the bottom of the form) since the ✓ key on the numpad now handles submission.

**And remove the `onSubmit` from the form tag** — change:
```jsx
<form onSubmit={handleSubmit} className="flex flex-col gap-4">
```
to:
```jsx
<form className="flex flex-col gap-4">
```

---

### Step 3 — Username field stays as normal text input

Keep the username input exactly as it is. Players type their name once (short word, easy), then use the numpad for the password. The keyboard only opens for the username.

If you want a username numpad too (e.g. pick from a list instead of typing), see the "Username Picker" section below.

---

### Optional: Username Picker (tap your name, no typing)

Instead of a text input for username, show all players as big tap buttons.

Replace the username `<input>` block in Login.jsx with:

```jsx
{/* Add at top of component: */}
const PLAYERS = ['aaron', 'player1', 'player2', 'player3', 'player4', 'player5'];

{/* Replace the username input with: */}
<div className="flex flex-col gap-1">
  <label
    className="text-xs font-mono tracking-widest uppercase"
    style={{ color: '#9ca3af' }}
  >
    Who are you?
  </label>
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
    {PLAYERS.map(name => (
      <button
        key={name}
        type="button"
        onClick={() => setUsername(name)}
        style={{
          padding: '16px 8px',
          backgroundColor: username === name ? '#f97316' : '#1a1a1a',
          color: username === name ? '#0a0a0a' : '#f1f1f1',
          border: `1px solid ${username === name ? '#f97316' : '#374151'}`,
          fontFamily: 'Courier New, monospace',
          fontWeight: 'bold',
          fontSize: 14,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          cursor: 'pointer',
        }}
      >
        {name}
      </button>
    ))}
  </div>
</div>
```

Update the `PLAYERS` array to match your actual friend usernames.

With this + the numpad, the entire login is tap-only. No keyboard ever opens.

---

### How to update the player list in the username picker

The `PLAYERS` array is hardcoded in Login.jsx. When you add a new user to the database, also add their name to this array:

```jsx
const PLAYERS = ['aaron', 'james', 'sarah', 'mike', 'tommy', 'lisa'];
```

Keep it in the same order as you want them displayed on screen.

---

## How The Game Works (Step by Step)

### Before the game — Admin setup
1. Everyone opens `https://cs2irl.aaronmale.me` and logs in
2. Admin (aaron) goes to **Admin panel**
3. Admin taps **Create Match**
4. Admin assigns everyone a team — CT or Terrorist
5. Admin hits **Start Match**
6. Server randomly picks one Terrorist to get the bomb, one CT to get the defuser
7. Everyone gets a notification: "Match started — check your role"

### Terrorist with the bomb
1. Your lobby shows **"YOU HAVE THE BOMB 💣"** — nobody else knows it's you yet
2. Tap **Go to Bomb** — you see a 4-digit plant code on screen
3. Go to the plant site in real life
4. Show teammates your plant code so they know you're there
5. Tap **Go Plant** — do the arrow minigame (hit the arrows in the right order)
6. If you mess up too many times — you fail and have to retry from the start
7. Complete it → bomb is planted → everyone's screen shows the countdown

### CT with the defuser
1. Your lobby shows **"YOU HAVE THE DEFUSER 🔧"**
2. Wait for the bomb to be planted — you'll see the countdown appear
3. Find the bomb carrier in real life
4. Tap **Defuse Bomb** → do the arrow minigame
5. Complete it before the timer hits zero → CTs win

### Everyone else
- Watch the countdown on your screen
- If you die in real life → tap **Mark myself as dead** on the Match screen
- If the CT with the defuser dies → any alive CT can tap **Pick up defuser** and physically grab their phone to defuse

### How the round ends
- **CTs win:** defuse completes before timer → "BOMB DEFUSED" screen + sound for everyone
- **Terrorists win:** timer hits zero → "BOMB EXPLODED" screen + explosion sound for everyone
- Admin hits **Reset Match** and you go again

---

## Game Troubleshooting

### "I don't know who has the bomb / defuser"
That's intentional — nobody knows until the match starts. Check your own screen after the admin starts. If YOU have it, your screen tells you. You don't get told about other players.

---

### "My screen didn't update / still shows old info"
The app updates in real-time over the internet. If it's stuck:
1. Pull to refresh or tap the browser refresh button
2. If that doesn't work — log out and log back in
3. The app reconnects automatically after a few seconds if signal drops

---

### "No arrows showing when I try to plant / defuse"

There are 4 things that can cause this:

**1. You failed the sequence — arrows disappear on purpose**
When you hit the wrong arrow too many times, the sequence resets and hides. You'll see a ❌ PLANT FAILED screen. You have to:
- Tap **TRY AGAIN** → takes you back to the Start screen
- Tap **START PLANTING** again → fetches a fresh sequence → arrows appear again

This is intentional. The sequence resets on failure so you can't just spam until you get it.

---

**2. The page shows NOT AUTHORIZED instead of arrows**
This means either:
- You are not the bomb holder (only the person assigned the bomb can plant)
- The match status is not `active` — if it's `planted` already, you can't plant again

Check the lobby — does it say "YOU HAVE THE BOMB 💣"? If not, you don't have it.

---

**3. The API call failed silently**
If you tapped Start Planting and nothing happened at all — no arrows, no error visible — check for a small red error box under the Start button. It might say "Failed to start planting" or "You are not the bomb holder".

If the backend is down this also causes a silent fail. Admin checks:
```
pm2 status
pm2 restart cs2-api
```

---

**4. You're on the wrong page**
The arrow sequence only shows on `/plant` (the planting page). `/bomb` is a different page — it just shows your plant code and a "Go Plant" button. Make sure you tapped Go Plant and are actually on the plant page (URL ends in `/plant`).

---

### "I tapped Start Plant but nothing happened"
Either:
- The backend is down — admin checks `pm2 status` on the server
- You're not the bomb holder — only the bomb carrier can plant
- Match isn't in `active` state — admin may need to check the match status

---

### "The arrow minigame is too hard / too easy"
Admin can change the difficulty in the **Admin panel → Match Config** before starting:
- **Plant/Defuse Sequence Length** — how many arrows to hit (default: 6)
- **Max Plant/Defuse Errors** — how many wrong taps before you fail (default: 3)

Change these before hitting Start Match.

---

### "The bomb timer isn't showing"
The timer only appears after the bomb is planted. If the bomb carrier completed planting but the timer isn't showing:
1. Refresh the page
2. Check the Match screen (not lobby) — timer shows there too
3. If the backend crashed — admin restarts with `pm2 restart cs2-api`

---

### "The defuser holder died and nobody can defuse"
1. The dead CT taps **Mark myself as dead** on their Match screen
2. Any other alive CT will then see a **Pick up defuser** button on their Match screen
3. They tap it, then physically walk over and grab the dead CT's phone
4. Now they can navigate to /defuse on their own phone

---

### "I completed the defuse but nothing happened"
- Check the backend logs — `pm2 logs cs2-api` on the server
- Make sure the match status was `planted` when you completed — if the bomb already exploded, the defuse does nothing
- Try refreshing — the win screen might already be showing

---

### "Admin accidentally started the match with wrong teams"
Hit **Reset Match** in the admin panel — this wipes the match completely. Then:
1. Create Match again
2. Reassign teams
3. Start again

---

### "A player can't log in"
- Check their username is spelled exactly right (lowercase)
- Check the password is correct — all should be `123456` unless changed
- If they get a blank screen or error — have them open browser console (F12) and run `localStorage.clear()`, then refresh

---

### "Notification banner isn't showing"
The banner shows on every page when key events happen (match start, bomb planted, etc.). If a player isn't seeing it:
- They might have been on a page that wasn't connected — have them refresh
- iPhones: must be using the **home screen app** (added via Safari → Share → Add to Home Screen) — notifications don't work in the regular Safari browser tab
- If completely broken — they'll still see the match state update on their screen, just no overlay

---

### "Someone's screen is frozen / stuck on loading"
1. Refresh the page
2. Log out and back in
3. If the backend is down — admin restarts it: `pm2 restart cs2-api` on the server

---

### "The game ended but admin can't reset"
The Reset button always works regardless of match state. If the button isn't responding:
1. Check the backend is running
2. Hard refresh the admin page (Ctrl+Shift+R)
3. SSH into server and restart: `pm2 restart cs2-api`

---

### "Everything is broken for everyone at once"
Backend crashed. SSH in and restart:
```
ssh root@188.166.95.26
pm2 restart cs2-api
pm2 logs cs2-api
```
Everyone refreshes their page and logs back in.

---

## Quick Admin Cheat Sheet (during the game)

| Problem | What to do |
|---|---|
| Wrong teams assigned | Reset Match → reassign → start again |
| Want to manually give someone the bomb | Admin panel → tap 💣 next to their name (lobby only) |
| Want to manually give someone the defuser | Admin panel → tap 🔧 next to their name (lobby only) |
| Someone died | They tap "Mark myself as dead" themselves, OR admin taps their ALIVE toggle |
| Someone came back to life | Admin taps DEAD toggle next to their name to revive |
| Match is stuck | Reset Match → start fresh |
| Server is down | `pm2 restart cs2-api` on the server |

---

## Quick Start (every time you work on it)

Open **two terminals**:

**Terminal 1 — Backend:**
```
cd "H:\Coding\Cs2 Sim irl\backend"
node index.js
```
You should see: `[SERVER] CS2 Bomb Sim backend running on port 3001`

**Terminal 2 — Frontend:**
```
cd "H:\Coding\Cs2 Sim irl\frontend"
npm run dev
```
You should see: `Local: http://localhost:5173/`

Open `http://localhost:5173` in your browser. Login: `aaron` / `123456` (admin).

---

## Accounts (all passwords: `123456`)

| Username | Role |
|---|---|
| aaron | Admin |
| player1–5 | Players |

To change a password, open a terminal in the backend folder and run:
```
node -e "
const db = require('better-sqlite3')('./db/cs2sim.db');
db.prepare(\"UPDATE users SET password = 'newpassword' WHERE username = 'aaron'\").run();
"
```

---

## Folder Map — What Lives Where

```
Cs2 Sim irl/
│
├── backend/               ← Node.js server (the brain)
│   ├── index.js           ← Entry point — starts server, wires everything together
│   ├── .env               ← Secret config — JWT_SECRET and PORT live here
│   ├── db/
│   │   ├── cs2sim.db      ← The actual database file (SQLite)
│   │   ├── database.js    ← Opens the database, runs schema on startup
│   │   └── schema.sql     ← Table definitions + seed users (runs once)
│   ├── routes/            ← All API endpoints
│   │   ├── auth.js        ← POST /api/auth/login
│   │   ├── match.js       ← Create/start/reset/config match
│   │   ├── admin.js       ← Assign teams, bomb, defuser, kill/revive
│   │   └── game.js        ← Plant, defuse, pickup defuser, mark dead
│   ├── services/
│   │   └── gameService.js ← Core logic: sequences, bomb timer, match state builder
│   ├── middleware/
│   │   ├── auth.js        ← Checks JWT token on every protected request
│   │   └── adminOnly.js   ← Blocks non-admins from admin routes
│   └── socket/
│       └── events.js      ← Handles real-time socket connections
│
├── frontend/              ← React app (what players see)
│   ├── public/
│   │   └── sounds/        ← Drop MP3s here (plant_start, defuse_start, etc.)
│   └── src/
│       ├── App.jsx        ← Router — defines all page routes
│       ├── main.jsx       ← Entry point — renders App
│       ├── index.css      ← Global styles + animation keyframes
│       ├── lib/
│       │   ├── api.js     ← Axios — all HTTP requests go through here
│       │   ├── auth.js    ← Token storage (localStorage)
│       │   └── socket.js  ← Socket.io connection
│       ├── components/
│       │   ├── SequenceGame.jsx     ← The arrow button minigame
│       │   ├── BombTimer.jsx        ← Countdown display
│       │   ├── PlayerCard.jsx       ← One player row in a list
│       │   ├── NotificationBanner.jsx ← Full-screen event overlay
│       │   └── ProtectedRoute.jsx   ← Redirects to login if no token
│       └── pages/
│           ├── Login.jsx   ← Login form
│           ├── Lobby.jsx   ← Main hub — player list, role CTAs
│           ├── Admin.jsx   ← Admin panel — teams, config, start/reset
│           ├── Match.jsx   ← Match status — timer, alive/dead, win screen
│           ├── Bomb.jsx    ← Bomb carrier — plant code + post-plant timer
│           ├── Plant.jsx   ← Planting minigame
│           └── Defuse.jsx  ← Defusing minigame
│
└── nginx/
    └── cs2sim.conf        ← Web server config (for production only)
```

---

## How The App Works (Simple Version)

```
1. Admin creates a match
2. Admin assigns players to CT or Terrorist teams
3. Admin hits Start → server randomly gives bomb to one T, defuser to one CT
4. Everyone gets a notification: "Match started, check your role"
5. Bomb carrier sees their plant code on /bomb, goes to plant site physically
6. They tap "Go Plant" → do the arrow minigame → bomb is planted
7. Everyone's screen shows a countdown timer
8. CT with defuser goes to /defuse → does the arrow minigame → defused
9. Win screen for everyone
```

---

## Why Pages Show "LOADING..." For a Second

Every time you navigate to a new page (Lobby → Bomb, Lobby → Match, etc.), the page does this:

```
1. You tap the button
2. New page opens
3. Page asks the server "what's the current match state?"  ← this takes time
4. Server responds
5. Page finally shows content
```

Step 3 is a network round-trip. On your PC it's instant because server and browser are the same machine. On a phone over the internet it takes 100–500ms — enough to see a loading flash.

**This is not a bug.** It's just how the app is built — each page fetches fresh data when it loads.

### Fix you can do yourself — Global Match Cache

The idea: store the last known match state in a global variable. Every time the server sends an update, save it there. When a page loads, read from it instantly — no network call needed.

---

**Step 1 — Create the cache file**

Create a new file: `frontend/src/lib/matchCache.js`

```js
let cachedMatchData = null;

export function getCachedMatch() {
  return cachedMatchData;
}

export function setCachedMatch(matchData) {
  cachedMatchData = matchData;
}
```

That's it. It's just a variable that survives between page navigations.

---

**Step 2 — Keep it updated in App.jsx**

Open `frontend/src/App.jsx` and add these two lines:

```js
// Add this import at the top with the other imports:
import { setCachedMatch } from './lib/matchCache';

// Add this inside the useEffect (after the connectSocket line):
socket.on('match:state', setCachedMatch);
```

Now every time the server sends match data to anyone, the cache updates automatically.

---

**Step 3 — Use the cache in each page**

In every page file that has this pattern at the top:
```js
const [matchData, setMatchData] = useState(null);
const [loading, setLoading] = useState(true);
```

Change it to:
```js
// Add import at top of file:
import { getCachedMatch } from '../lib/matchCache';

// Change the useState lines to:
const [matchData, setMatchData] = useState(getCachedMatch());
const [loading, setLoading] = useState(!getCachedMatch());
```

Do this in: `Lobby.jsx`, `Match.jsx`, `Bomb.jsx`, `Plant.jsx`, `Defuse.jsx`, `Admin.jsx`

---

**Result:**
- First time you open the app → still fetches once (normal)
- Every navigation after that → instant, reads from cache
- Socket events still update everything live as before
- No logic changes, no new dependencies

The cache is just a JS variable — it resets if you refresh the page, but that's fine since a refresh triggers a fresh fetch anyway.

---

### Is this the same as useMemo?

No. Easy way to remember the difference:

| | What it is | Lives where | Survives navigation? |
|---|---|---|---|
| `useMemo` | Caches an expensive calculation | Inside one component | ❌ No — gone when page changes |
| Module variable (what we did) | Caches data in a plain JS variable | Outside React entirely | ✅ Yes — survives page changes |
| `useContext` | Shares state across all components | React tree | ✅ Yes |

`useMemo` is for when you have a slow calculation inside a component and don't want to redo it on every render. Example: filtering a list of 10,000 players — you'd `useMemo` the filter result so it doesn't rerun unless the list changes.

It would NOT fix the loading delay because when you navigate to a new page the old component unmounts, `useMemo` disappears with it, and the new page starts from scratch anyway.

What fixes the loading delay is storing data **outside** React so it survives between page navigations — which is exactly what the module variable does.

---

## Common Problems & Fixes

### "Failed to load match data"
**Cause:** Backend isn't running, or JWT_SECRET is missing.

Check your backend terminal — is it running? If yes:
```
cd "H:\Coding\Cs2 Sim irl\backend"
node -e "require('dotenv').config(); console.log(process.env.JWT_SECRET)"
```
If it prints `undefined`, the `.env` file is broken. Fix:
Open `H:\Coding\Cs2 Sim irl\backend\.env` and make sure it says exactly:
```
JWT_SECRET=localsecret
PORT=3001
```
Restart the backend after editing.

---

### "Invalid signature" or "secret must be provided" in backend logs
**Cause:** Player's browser has an old token signed with a different/missing JWT_SECRET.

**Fix:** Tell the player to open browser console (F12) and run:
```js
localStorage.clear()
```
Then refresh and log in again.

---

### Login works but everything is broken / blank
**Cause:** Same as above — stale token.
**Fix:** `localStorage.clear()` in browser console, refresh, log in again.

---

### Frontend won't start — PostCSS error or JSON parse error
**Cause:** Files have Windows BOM encoding (happens when files are created by PowerShell).

Run this in PowerShell from the project root:
```powershell
Get-ChildItem "frontend\src" -Recurse -Include "*.jsx","*.js","*.css","*.json" | ForEach-Object {
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    if ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $content = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8)
        [System.IO.File]::WriteAllText($_.FullName, $content, (New-Object System.Text.UTF8Encoding $false))
        Write-Host "Fixed: $($_.Name)"
    }
}
```

---

### Sound not playing
**Cause:** File doesn't exist in `frontend/public/sounds/` or browser blocked autoplay.

Check the file is there:
```
ls "H:\Coding\Cs2 Sim irl\frontend\public\sounds\"
```
Should show: `plant_start.mp3`, `defuse_start.mp3`, `defused_win.mp3`, `explode_win.mp3`

Autoplay note: browser requires a user interaction before audio plays. The sounds trigger on button clicks, so this should always work. If it doesn't, check the browser console (F12) for errors.

---

### Socket not connecting / real-time not working
**Cause:** Backend not running, or player's token is invalid.

Check backend terminal for `[SOCKET] Client connected`. If you see `invalid token`, tell player to clear localStorage and re-login.

---

### "No terrorists assigned" / "No counter-terrorists assigned" when starting match
**Cause:** Admin hasn't assigned players to both teams yet.

Go to Admin panel, make sure at least one player is set to `CT` and one to `Terrorist` before hitting Start.

---

### Database is messed up / want to start fresh
Delete the database file and restart the backend — it will recreate it with fresh seed data:
```
del "H:\Coding\Cs2 Sim irl\backend\db\cs2sim.db"
node index.js
```

---

## Styling Guide

### Colors Used (change these to restyle)

Everything uses inline `style={{}}` props and Tailwind. The main colors:

| Thing | Color | Where to change |
|---|---|---|
| Background | `#0a0a0a` (near black) | Every page, `style={{ backgroundColor: '#0a0a0a' }}` |
| Orange accent | `#f97316` | Headers, T team, bomb buttons |
| Blue accent | `#1d4ed8` | CT team, defuser buttons |
| Border lines | `#1f2937` | Most borders |
| Text primary | `#f1f1f1` | Main text |
| Text muted | `#9ca3af` | Subtitles, secondary text |
| Green (success) | `#4ade80` | Alive, success states |
| Red (danger) | `#ef4444` | Dead, exploded states |

To change the main orange to a different color, do a find-and-replace for `#f97316` across all files in `src/`.

---

### Adding shadcn/ui

shadcn gives you pre-built components like buttons, cards, dialogs etc. Install it:

```
cd "H:\Coding\Cs2 Sim irl\frontend"
npx shadcn@latest init
```

When it asks:
- Style: **Default**
- Base color: pick one (Slate works well with dark themes)
- CSS variables: **Yes**

Then add individual components as needed:
```
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
npx shadcn@latest add badge
```

Components go into `src/components/ui/` automatically.

**Example — replacing a plain button with shadcn Button:**
```jsx
// Before
<button style={{ backgroundColor: '#f97316' }} onClick={handleClick}>
  START MATCH
</button>

// After (import at top of file)
import { Button } from '../components/ui/button';

<Button variant="default" onClick={handleClick}>
  START MATCH
</Button>
```

---

### Changing the Minigame Button Layout

The arrow buttons are in `src/components/SequenceGame.jsx`. They're large squares arranged like a D-pad. To change size, find the button style and adjust width/height values.

---

### Changing the Countdown Timer Style

`src/components/BombTimer.jsx` — the timer goes red and pulses under 10 seconds. To change the threshold, find `remaining < 10` and change `10` to whatever you want.

---

## How to Add New Features

### Pattern: Adding a new button/action in the admin panel

1. **Add a backend route** in `backend/routes/admin.js`:
```js
router.post('/my-new-action', (req, res) => {
  const match = getCurrentMatch(db);
  if (!match) return res.status(404).json({ error: 'No match' });
  
  // do something to the DB
  db.prepare('UPDATE match SET something = ? WHERE id = ?').run(value, match.id);
  
  const state = getMatchState(db, match.id);
  io.emit('match:state', state); // tell everyone about the change
  return res.json(state);
});
```

2. **Call it from the frontend** in `frontend/src/pages/Admin.jsx`:
```js
async function myNewAction() {
  await doAction(() => api.post('/admin/my-new-action'), 'Done!');
}
```

3. **Add a button** in the JSX:
```jsx
<ActionButton onClick={myNewAction} color="#166534" textColor="#4ade80">
  MY NEW ACTION
</ActionButton>
```

---

### Pattern: Adding a new socket notification

In any backend route, after making a change:
```js
io.emit('game:notification', {
  title: '🔔 Something Happened',
  body: 'Details about what happened'
});
```

The `NotificationBanner` component in the frontend listens for this and shows a fullscreen overlay automatically on every player's phone. No other changes needed.

---

### Pattern: Adding a new page

1. Create `frontend/src/pages/MyPage.jsx`
2. Add the route in `frontend/src/App.jsx`:
```jsx
import MyPage from './pages/MyPage';
// inside <Routes>:
<Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
```
3. Navigate to it from anywhere with:
```js
import { useNavigate } from 'react-router-dom';
const navigate = useNavigate();
navigate('/mypage');
```

---

### Pattern: Adding a new database column

1. Edit `backend/db/schema.sql` — add the column to the relevant table
2. **Delete** `backend/db/cs2sim.db` (the database file) to force a rebuild
3. Restart the backend — it recreates the database with the new column
4. Update any queries in `backend/services/gameService.js` or the relevant route

---

## Real-Time Events Cheat Sheet

These are the socket events that flow between server and clients.

| Event | Direction | When it fires |
|---|---|---|
| `match:state` | Server → Everyone | Any time match data changes |
| `match:planted` | Server → Everyone | Bomb is planted, includes `{ explode_at }` |
| `match:defused` | Server → Everyone | Bomb defused |
| `match:exploded` | Server → Everyone | Timer ran out |
| `match:started` | Server → Everyone | Admin starts match |
| `game:notification` | Server → Everyone | Key events (banner + vibration) |
| `player:join` | Client → Server | On login and on every reconnect |

**To listen for an event in any React component:**
```js
import socket from '../lib/socket';
import { useEffect } from 'react';

useEffect(() => {
  function handler(data) {
    console.log('Got event:', data);
  }
  socket.on('match:state', handler);
  return () => socket.off('match:state', handler); // ALWAYS clean up
}, []);
```

---

## API Endpoints Cheat Sheet

All requests need a JWT token in the header (the `api.js` lib adds it automatically).

```
POST   /api/auth/login              { username, password } → { token }

GET    /api/match                   → { match, players[] }
POST   /api/match                   → create match (admin)
PATCH  /api/match/config            → update timer/sequence settings (admin)
POST   /api/match/start             → start match (admin)
POST   /api/match/reset             → delete match (admin)

POST   /api/admin/assign-team       { user_id, team: 'ct'|'terrorist' }
POST   /api/admin/assign-bomb       { user_id }
POST   /api/admin/assign-defuser    { user_id }
POST   /api/admin/kill-player       { user_id }
POST   /api/admin/revive-player     { user_id }

POST   /api/game/plant/start        → returns { sequence: ['up','down',...] }
POST   /api/game/plant/complete     { errors: 0 } → plants bomb
POST   /api/game/defuse/start       → returns { sequence }
POST   /api/game/defuse/complete    { errors: 0 } → defuses bomb
POST   /api/game/pickup-defuser     → transfers defuser to you
POST   /api/game/mark-dead          → marks you as dead
```

Test any endpoint manually with curl (in a terminal):
```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"aaron\",\"password\":\"123456\"}"

# Get match state (replace TOKEN with the token from login)
curl http://localhost:3001/api/match \
  -H "Authorization: Bearer TOKEN"
```

---

## Sound Files

All sounds go in `frontend/public/sounds/`. The browser can play MP3 and WAV.

| File | Plays when | Who hears it |
|---|---|---|
| `plant_start.mp3` | Planter taps Start Planting | Planter only |
| `defuse_start.mp3` | CT taps Start Defusing | CT only |
| `defused_win.mp3` | Bomb defused event | Everyone on that page |
| `explode_win.mp3` | Bomb explodes event | Everyone on that page |

To add a new sound:
1. Drop the file in `frontend/public/sounds/`
2. Play it anywhere in React:
```js
new Audio('/sounds/your-file.mp3').play().catch(() => {});
```
The `.catch(() => {})` silently handles browser autoplay blocks.

---

## Deployment (Simple Version)

The app runs on a DigitalOcean server at `188.166.95.26` → `cs2irl.aaronmale.me`.

**Quick deploy after making changes:**

1. Build the frontend (creates the production files):
```
cd "H:\Coding\Cs2 Sim irl\frontend"
npm run build
```

2. Upload to server (run from your PC, not the server):
```
scp -r "H:\Coding\Cs2 Sim irl\backend" root@188.166.95.26:/var/www/cs2sim/
scp -r "H:\Coding\Cs2 Sim irl\frontend\dist" root@188.166.95.26:/var/www/cs2sim/frontend/
```

3. SSH into server and restart:
```
ssh root@188.166.95.26
cd /var/www/cs2sim/backend
npm install
pm2 restart cs2-api
```

**Server is down?** SSH in and check:
```
ssh root@188.166.95.26
pm2 status          ← is cs2-api running?
pm2 logs cs2-api    ← what errors?
pm2 restart cs2-api ← restart it
```

**Full deploy guide is in CLAUDE.md** under the Deployment section.

---

## Things That Are Normal / Not Bugs

- Backend logs a lot on startup — that's `npm install` output from `better-sqlite3`
- Socket logs `player:join invalid token` when someone has a stale token — clear localStorage
- iPhone players MUST use Safari → Add to Home Screen → open from home screen
- Sounds don't play on mobile until the user has tapped something first (browser rule)
- The lobby shows ALL 6 users even if they haven't been assigned to the match yet

---

## Quick Reference: Key Files to Edit for Common Changes

| I want to change... | Edit this file |
|---|---|
| Colors / look of any page | The specific page in `src/pages/` |
| The arrow minigame | `src/components/SequenceGame.jsx` |
| The countdown timer | `src/components/BombTimer.jsx` |
| The notification popup | `src/components/NotificationBanner.jsx` |
| Player card appearance | `src/components/PlayerCard.jsx` |
| Admin panel | `src/pages/Admin.jsx` |
| Match screen | `src/pages/Match.jsx` |
| Bomb carrier screen | `src/pages/Bomb.jsx` |
| Who can access what route | `src/components/ProtectedRoute.jsx` + `src/App.jsx` |
| Bomb timer duration | Admin panel config OR `backend/db/schema.sql` default value |
| Sequence length / max errors | Admin panel config OR `backend/db/schema.sql` default value |
| User passwords | Run the node command in the Accounts section above |
| Add a new user | `backend/db/schema.sql` — add a line to the INSERT OR IGNORE block, then delete the .db file and restart |
