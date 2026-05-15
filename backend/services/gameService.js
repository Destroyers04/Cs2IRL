'use strict';

// In-memory store for active sequences, keyed by `${matchId}:${userId}:${type}`
const activeSequences = new Map();

// Timer state
let bombTimeout = null;
let matchTimeout = null;

/**
 * Generate a random directional sequence.
 * @param {number} length
 * @returns {string[]}
 */
function generateSequence(length) {
  const directions = ['up', 'down', 'left', 'right'];
  return Array.from({ length }, () => directions[Math.floor(Math.random() * 4)]);
}

/**
 * Store a generated sequence in memory.
 * @param {number} matchId
 * @param {number} userId
 * @param {'plant'|'defuse'} type
 * @param {string[]} sequence
 */
function storeSequence(matchId, userId, type, sequence) {
  const sequenceKey = `${matchId}:${userId}:${type}`;
  activeSequences.set(sequenceKey, sequence);
}

/**
 * Retrieve and remove a stored sequence from memory.
 * @param {number} matchId
 * @param {number} userId
 * @param {'plant'|'defuse'} type
 * @returns {string[]|null}
 */
function consumeSequence(matchId, userId, type) {
  const sequenceKey = `${matchId}:${userId}:${type}`;
  const storedSequence = activeSequences.get(sequenceKey) || null;
  activeSequences.delete(sequenceKey);
  return storedSequence;
}

/**
 * Clear a stored sequence without consuming it (e.g., on failure/reset).
 * @param {number} matchId
 * @param {number} userId
 * @param {'plant'|'defuse'} type
 */
function clearSequence(matchId, userId, type) {
  const sequenceKey = `${matchId}:${userId}:${type}`;
  activeSequences.delete(sequenceKey);
}

/**
 * Clear all sequences for a given match (on reset).
 * @param {number} matchId
 */
function clearAllSequencesForMatch(matchId) {
  for (const sequenceKey of activeSequences.keys()) {
    if (sequenceKey.startsWith(`${matchId}:`)) {
      activeSequences.delete(sequenceKey);
    }
  }
}

/**
 * Start the bomb explosion timer.
 * @param {number} matchId
 * @param {number} seconds
 * @param {import('socket.io').Server} io
 * @param {import('better-sqlite3').Database} db
 */
function startBombTimer(matchId, seconds, io, db) {
  clearBombTimer();

  bombTimeout = setTimeout(() => {
    bombTimeout = null;

    // Update match to exploded
    const updateStatement = db.prepare(
      `UPDATE match SET status = 'exploded', winner_team = 'terrorist' WHERE id = ?`
    );
    updateStatement.run(matchId);

    // Build full match state for broadcast
    const matchState = getMatchState(db, matchId);

    io.emit('match:exploded', { winner: 'terrorist' });
    io.emit('match:state', matchState);
    io.emit('game:notification', {
      title: '💥 BOMB EXPLODED',
      body: 'Terrorists win!'
    });

    console.log(`[BOMB TIMER] Match ${matchId} exploded`);
  }, seconds * 1000);

  console.log(`[BOMB TIMER] Started ${seconds}s timer for match ${matchId}`);
}

/**
 * Clear the bomb timer (called on defuse or reset).
 */
function clearBombTimer() {
  if (bombTimeout) {
    clearTimeout(bombTimeout);
    bombTimeout = null;
    console.log('[BOMB TIMER] Cleared');
  }
}

/**
 * Start the match length timer. When it fires (bomb never planted), CTs win.
 * @param {number} matchId
 * @param {number} seconds
 * @param {import('socket.io').Server} io
 * @param {import('better-sqlite3').Database} db
 */
function startMatchTimer(matchId, seconds, io, db) {
  clearMatchTimer();

  matchTimeout = setTimeout(() => {
    matchTimeout = null;

    // Only end the match if it's still in active state (bomb not planted)
    const currentMatch = db.prepare('SELECT status FROM match WHERE id = ?').get(matchId);
    if (!currentMatch || currentMatch.status !== 'active') return;

    db.prepare(`UPDATE match SET status = 'defused', winner_team = 'ct' WHERE id = ?`).run(matchId);

    const matchState = getMatchState(db, matchId);
    io.emit('match:defused', { winner: 'ct' });
    io.emit('match:state', matchState);
    io.emit('game:notification', {
      title: "⏱️ Time's up",
      body: 'Counter-Terrorists win!',
    });

    console.log(`[MATCH TIMER] Match ${matchId} expired — CT win`);
  }, seconds * 1000);

  console.log(`[MATCH TIMER] Started ${seconds}s timer for match ${matchId}`);
}

/**
 * Clear the match length timer (called when bomb is planted or match resets).
 */
function clearMatchTimer() {
  if (matchTimeout) {
    clearTimeout(matchTimeout);
    matchTimeout = null;
    console.log('[MATCH TIMER] Cleared');
  }
}

/**
 * Build full match state object (match row + players array) for socket broadcast.
 * @param {import('better-sqlite3').Database} db
 * @param {number} matchId
 * @returns {object|null}
 */
function getMatchState(db, matchId) {
  const matchRow = db.prepare('SELECT * FROM match WHERE id = ?').get(matchId);
  if (!matchRow) return null;

  // Return ALL users with match_players data merged in (LEFT JOIN).
  // Players not yet assigned to the match have team=null, is_alive=null.
  const allPlayersWithMatchData = db.prepare(`
    SELECT
      u.id,
      u.id AS user_id,
      u.username,
      mp.team,
      COALESCE(mp.is_alive, 1) AS is_alive,
      CASE WHEN u.id = ? THEN 1 ELSE 0 END AS is_bomb_holder
    FROM users u
    LEFT JOIN match_players mp ON mp.user_id = u.id AND mp.match_id = ?
    ORDER BY u.id
  `).all(matchRow.bomb_holder_id, matchId);

  return { match: matchRow, players: allPlayersWithMatchData };
}

/**
 * Get the current active (non-terminal) match, if any.
 * @param {import('better-sqlite3').Database} db
 * @returns {object|null}
 */
function getCurrentMatch(db) {
  return db.prepare(
    `SELECT * FROM match WHERE status NOT IN ('defused', 'exploded') ORDER BY id DESC LIMIT 1`
  ).get() || null;
}

/**
 * Check if all players on a team are dead, and if so end the match.
 * Returns true if the match was ended, false otherwise.
 * @param {number} matchId
 * @param {import('socket.io').Server} io
 * @param {import('better-sqlite3').Database} db
 */
function checkAllDeadWin(matchId, io, db) {
  const matchRow = db.prepare('SELECT status FROM match WHERE id = ?').get(matchId);
  if (!matchRow || !['active', 'planted'].includes(matchRow.status)) return false;

  const players = db.prepare(
    'SELECT team, is_alive FROM match_players WHERE match_id = ?'
  ).all(matchId);

  const terrorists = players.filter(p => p.team === 'terrorist');
  const cts = players.filter(p => p.team === 'ct');

  if (terrorists.length === 0 || cts.length === 0) return false;

  const allTerroristsDead = terrorists.every(p => !p.is_alive);
  const allCTsDead = cts.every(p => !p.is_alive);

  if (!allTerroristsDead && !allCTsDead) return false;

  if (allTerroristsDead) {
    db.prepare(`UPDATE match SET status = 'defused', winner_team = 'ct' WHERE id = ?`).run(matchId);
    clearBombTimer();
    clearMatchTimer();
    const matchState = getMatchState(db, matchId);
    io.emit('match:defused', { winner: 'ct' });
    io.emit('match:state', matchState);
  } else {
    db.prepare(`UPDATE match SET status = 'exploded', winner_team = 'terrorist' WHERE id = ?`).run(matchId);
    clearBombTimer();
    clearMatchTimer();
    const matchState = getMatchState(db, matchId);
    io.emit('match:exploded', { winner: 'terrorist' });
    io.emit('match:state', matchState);
  }

  return true;
}

module.exports = {
  generateSequence,
  storeSequence,
  consumeSequence,
  clearSequence,
  clearAllSequencesForMatch,
  startBombTimer,
  clearBombTimer,
  startMatchTimer,
  clearMatchTimer,
  getMatchState,
  getCurrentMatch,
  checkAllDeadWin,
};
