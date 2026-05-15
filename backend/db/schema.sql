CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,
  discord_id TEXT,
  is_admin   INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS match (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  status                 TEXT DEFAULT 'lobby',
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
  winner_team            TEXT,
  plant_code             TEXT,
  created_at             TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS match_players (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER REFERENCES match(id),
  user_id  INTEGER REFERENCES users(id),
  team     TEXT NOT NULL,
  is_alive INTEGER DEFAULT 1,
  UNIQUE(match_id, user_id)
);

CREATE TABLE IF NOT EXISTS sequence_attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id     INTEGER REFERENCES match(id),
  user_id      INTEGER REFERENCES users(id),
  type         TEXT,
  success      INTEGER,
  errors       INTEGER DEFAULT 0,
  attempted_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO users (username, password, is_admin) VALUES
  ('RamAnal',     '090811', 0),
  ('TehranToxic', '240614', 0),
  ('CyaBald',     '260298', 0),
  ('Des04',       '211102', 1),
  ('Sjokoqueef',     '020702', 0),
  ('Dork3stfart3r',  '170611', 0);
