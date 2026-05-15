'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'cs2sim.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
  // Migrate existing DBs that predate these columns
  try { db.exec('ALTER TABLE match ADD COLUMN plant_timer_seconds INTEGER DEFAULT 15'); } catch {}
  try { db.exec('ALTER TABLE match ADD COLUMN defuse_timer_seconds INTEGER DEFAULT 10'); } catch {}
  try { db.exec('ALTER TABLE match ADD COLUMN arrow_time_seconds REAL DEFAULT 2'); } catch {}
  try { db.exec('ALTER TABLE match ADD COLUMN match_length_seconds INTEGER DEFAULT 120'); } catch {}
  try { db.exec('ALTER TABLE match ADD COLUMN match_end_time TEXT'); } catch {}

  // Remove defuser_holder_id column if it still exists (SQLite requires table recreation)
  const matchCols = db.pragma('table_info(match)');
  if (matchCols.some(col => col.name === 'defuser_holder_id')) {
    // Disable FK checks so DROP TABLE match doesn't fail (match_players references it)
    db.pragma('foreign_keys = OFF');
    db.exec(`
      BEGIN;
      CREATE TABLE match_clean (
        id                     INTEGER PRIMARY KEY AUTOINCREMENT,
        status                 TEXT DEFAULT 'lobby',
        bomb_timer_seconds     INTEGER DEFAULT 40,
        plant_sequence_length  INTEGER DEFAULT 6,
        defuse_sequence_length INTEGER DEFAULT 6,
        max_plant_errors       INTEGER DEFAULT 3,
        max_defuse_errors      INTEGER DEFAULT 3,
        bomb_holder_id         INTEGER REFERENCES users(id),
        plant_start_time       TEXT,
        bomb_explode_time      TEXT,
        winner_team            TEXT,
        plant_code             TEXT,
        created_at             TEXT DEFAULT (datetime('now')),
        plant_timer_seconds    INTEGER DEFAULT 15,
        defuse_timer_seconds   INTEGER DEFAULT 10,
        arrow_time_seconds     REAL DEFAULT 2,
        match_length_seconds   INTEGER DEFAULT 120,
        match_end_time         TEXT
      );
      INSERT INTO match_clean
        SELECT id, status, bomb_timer_seconds, plant_sequence_length, defuse_sequence_length,
               max_plant_errors, max_defuse_errors, bomb_holder_id, plant_start_time,
               bomb_explode_time, winner_team, plant_code, created_at,
               COALESCE(plant_timer_seconds, 15), COALESCE(defuse_timer_seconds, 10),
               COALESCE(arrow_time_seconds, 2), COALESCE(match_length_seconds, 120),
               match_end_time
        FROM match;
      DROP TABLE match;
      ALTER TABLE match_clean RENAME TO match;
      COMMIT;
    `);
    db.pragma('foreign_keys = ON');
    console.log('[DB] Removed defuser_holder_id column from match table');
  }

  // Remove legacy placeholder users (clean up dependents first)
  const legacyUsers = ['aaron','player1','player2','player3','player4','player5'];
  const placeholders = legacyUsers.map(() => '?').join(',');
  const legacyIds = db.prepare(`SELECT id FROM users WHERE username IN (${placeholders})`).all(...legacyUsers).map(r => r.id);
  if (legacyIds.length) {
    const idPlaceholders = legacyIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM match_players WHERE user_id IN (${idPlaceholders})`).run(...legacyIds);
    db.prepare(`DELETE FROM sequence_attempts WHERE user_id IN (${idPlaceholders})`).run(...legacyIds);
    db.prepare(`UPDATE match SET bomb_holder_id = NULL WHERE bomb_holder_id IN (${idPlaceholders})`).run(...legacyIds);
    db.prepare(`DELETE FROM users WHERE id IN (${idPlaceholders})`).run(...legacyIds);
  }

  console.log('[DB] Database initialized successfully');
}

module.exports = { db, initDb };
