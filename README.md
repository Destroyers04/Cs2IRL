# CS2 Real Life Bomb Defusal Simulator

Brings CS2's bomb defusal mode into the real world. Built in a day for a group of friends.

Players split into Terrorists and Counter-Terrorists via an admin panel. One terrorist gets secretly assigned the bomb when the match starts. They plant it using a directional arrow minigame on their phone. CTs have to find them, get the plant code off their screen, and defuse it before the bomb goes off.

Everything runs in real-time via Socket.io. Audio cues fire on every phone for key events.

Live at: [cs2irl.aaronmale.me](https://cs2irl.aaronmale.me)

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite + Tailwind v4 |
| Routing | React Router v6 |
| Real-time | Socket.io |
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) |
| Auth | JWT |
| Hosting | DigitalOcean + Nginx + PM2 |

---

## How it works

1. Admin creates a match and assigns players to teams (or randomizes)
2. Admin configures timers, sequence lengths, and error limits
3. Match starts — one terrorist is secretly assigned the bomb
4. Bomb carrier navigates to `/plant` and completes the arrow sequence minigame
5. Once planted, a 4-digit code appears on the bomb carrier's screen and the countdown starts
6. Any alive CT can go to `/defuse`, enter the code, and complete the defuse sequence
7. CTs win if they defuse in time. Terrorists win if the bomb explodes or all CTs are eliminated

---

## Features

- Real-time state sync across all devices via Socket.io
- Directional arrow minigame with per-arrow timeouts, strike limits, and error tracking
- Admin panel: team assignment, bomb assignment override, match config, kill/revive players
- Configurable: bomb timer, plant/defuse sequence length, error limits, arrow speed, match length
- Audio cues for plant, defuse, and explosion events
- Automatic reconnection, rejoining mid-match works

---

## Running locally

```bash
# Backend
cd backend
npm install
echo "JWT_SECRET=yoursecret" > .env
echo "PORT=3001" >> .env
node index.js

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

---

## Notes

Private app built for a specific group of friends. Auth is intentionally simplified (no bcrypt, no registration). Not intended for public use.
