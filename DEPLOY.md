# Tomorrow's Plan — Deploy + Setup

---

## Before You Deploy — Do This First (on your PC)

### 1. Add your friends' real usernames
Open a terminal in the backend folder and run:
```
node -e "
const db = require('better-sqlite3')('./db/cs2sim.db');
db.prepare(\"INSERT OR IGNORE INTO users (username, password) VALUES ('friendname', '123456')\").run();
console.log('done');
"
```
Repeat for each friend. Replace `friendname` and `123456`.

To see all current users:
```
node -e "
const db = require('better-sqlite3')('./db/cs2sim.db');
console.log(db.prepare('SELECT id, username FROM users').all());
"
```

To delete a user:
```
node -e "
const db = require('better-sqlite3')('./db/cs2sim.db');
db.prepare(\"DELETE FROM users WHERE username = 'player1'\").run();
"
```

---

## Deploy Checklist (do in order)

### On your PC first

- [ ] Add real friend usernames (see above)
- [ ] Build the frontend:
```
cd "H:\Coding\Cs2 Sim irl\frontend"
npm run build
```
You'll see a `dist/` folder appear inside frontend — that's what gets uploaded.

---

### Upload to server (run from your PC, not the server)

Open a terminal on your PC and run these one at a time:
```
scp -r "H:\Coding\Cs2 Sim irl\backend" root@188.166.95.26:/var/www/cs2sim/

scp -r "H:\Coding\Cs2 Sim irl\frontend\dist" root@188.166.95.26:/var/www/cs2sim/frontend/

scp "H:\Coding\Cs2 Sim irl\nginx\cs2sim.conf" root@188.166.95.26:/etc/nginx/sites-available/cs2sim
```

---

### On the server (SSH in first: `ssh root@188.166.95.26`)

**Install everything (first time only):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx
npm install -g pm2
mkdir -p /var/www/cs2sim/frontend
```

**Install backend dependencies:**
```bash
cd /var/www/cs2sim/backend
npm install
```

**Create the .env on the server:**
```bash
cat > /var/www/cs2sim/backend/.env << 'EOF'
JWT_SECRET=cs2irl_super_secret_change_this_2024
PORT=3001
EOF
```

**Set up Nginx:**
```bash
ln -s /etc/nginx/sites-available/cs2sim /etc/nginx/sites-enabled/cs2sim
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

**Start the backend with PM2:**
```bash
cd /var/www/cs2sim/backend
pm2 start index.js --name cs2-api
pm2 save
pm2 startup
```
Copy and run whatever command `pm2 startup` prints out.

**Get SSL (HTTPS):**
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d cs2irl.aaronmale.me
```
Follow the prompts — enter your email, agree to terms, done.

**Test it:**
Open `https://cs2irl.aaronmale.me` on your phone.

---

## After Deploy — Adding/Changing Users on the Live Server

SSH into the server first:
```
ssh root@188.166.95.26
cd /var/www/cs2sim/backend
```

**Add a user:**
```
node -e "
const db = require('better-sqlite3')('./db/cs2sim.db');
db.prepare(\"INSERT OR IGNORE INTO users (username, password) VALUES ('friendname', '123456')\").run();
console.log('added');
"
```

**Change a password:**
```
node -e "
const db = require('better-sqlite3')('./db/cs2sim.db');
db.prepare(\"UPDATE users SET password = 'newpass' WHERE username = 'aaron'\").run();
console.log('done');
"
```

**Delete a user:**
```
node -e "
const db = require('better-sqlite3')('./db/cs2sim.db');
db.prepare(\"DELETE FROM users WHERE username = 'player1'\").run();
console.log('done');
"
```

**See all users:**
```
node -e "
const db = require('better-sqlite3')('./db/cs2sim.db');
console.log(db.prepare('SELECT id, username, is_admin FROM users').all());
"
```

**Make someone an admin:**
```
node -e "
const db = require('better-sqlite3')('./db/cs2sim.db');
db.prepare(\"UPDATE users SET is_admin = 1 WHERE username = 'friendname'\").run();
"
```

No restart needed — user changes take effect immediately.

---

## If Something Breaks on the Server

**Check if backend is running:**
```
pm2 status
```
Should show `cs2-api` with status `online`.

**View live backend logs:**
```
pm2 logs cs2-api
```
Press Ctrl+C to exit logs.

**Restart backend:**
```
pm2 restart cs2-api
```

**Nginx not working:**
```
nginx -t              ← check config for errors
systemctl reload nginx
systemctl status nginx
```

**Redeploy after code changes:**
```bash
# On your PC — build frontend
cd "H:\Coding\Cs2 Sim irl\frontend"
npm run build

# Upload new files
scp -r "H:\Coding\Cs2 Sim irl\frontend\dist" root@188.166.95.26:/var/www/cs2sim/frontend/
scp -r "H:\Coding\Cs2 Sim irl\backend" root@188.166.95.26:/var/www/cs2sim/

# On the server
ssh root@188.166.95.26
cd /var/www/cs2sim/backend
npm install
pm2 restart cs2-api
```

---

## Tell Your Friends (iPhone vs Android)

**Android:** Open `https://cs2irl.aaronmale.me` in Chrome. Done.

**iPhone:** Open in Safari → tap the Share button → "Add to Home Screen" → open the app from the home screen icon. Must use the home screen icon, not Safari directly.

---

## Local Dev (on your PC) — User Commands

Same commands as above but run from the backend folder on your PC:
```
cd "H:\Coding\Cs2 Sim irl\backend"
```
Then paste any of the node commands above. The database file is at `backend/db/cs2sim.db`.
