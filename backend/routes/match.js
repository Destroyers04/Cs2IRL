'use strict';

const express = require('express');
const { db } = require('../db/database');
const { verifyJWT } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');
const {
  getMatchState,
  getCurrentMatch,
  generateSequence,
  clearAllSequencesForMatch,
  clearBombTimer,
  startMatchTimer,
  clearMatchTimer,
} = require('../services/gameService');

function createMatchRouter(io) {
  const router = express.Router();

  // GET /api/match — full match state + players
  router.get('/', verifyJWT, (req, res) => {
    const latestMatch = db.prepare('SELECT * FROM match ORDER BY id DESC LIMIT 1').get();
    if (!latestMatch) {
      return res.json(null);
    }

    const matchState = getMatchState(db, latestMatch.id);
    return res.json(matchState);
  });

  // POST /api/match — create new match (admin only)
  router.post('/', verifyJWT, adminOnly, (req, res) => {
    // Generate random 4-digit plant code
    const plantCode = String(Math.floor(1000 + Math.random() * 9000));

    const dbResult = db.prepare(`
      INSERT INTO match (status, plant_code)
      VALUES ('lobby', ?)
    `).run(plantCode);

    const newMatchId = dbResult.lastInsertRowid;
    const matchState = getMatchState(db, newMatchId);

    io.emit('match:state', matchState);
    return res.status(201).json(matchState);
  });

  // PATCH /api/match/config — update match config (admin only)
  router.patch('/config', verifyJWT, adminOnly, (req, res) => {
    const currentMatch = getCurrentMatch(db);
    if (!currentMatch) {
      return res.status(404).json({ error: 'No active match found' });
    }

    if (currentMatch.status !== 'lobby') {
      return res.status(400).json({ error: 'Cannot change config after match has started' });
    }

    const {
      bomb_timer_seconds,
      plant_sequence_length,
      defuse_sequence_length,
      max_plant_errors,
      max_defuse_errors,
      plant_timer_seconds,
      defuse_timer_seconds,
      arrow_time_seconds,
      match_length_seconds,
    } = req.body;

    const sqlFields = [];
    const sqlValues = [];

    if (bomb_timer_seconds !== undefined) {
      sqlFields.push('bomb_timer_seconds = ?');
      sqlValues.push(Number(bomb_timer_seconds));
    }
    if (plant_sequence_length !== undefined) {
      sqlFields.push('plant_sequence_length = ?');
      sqlValues.push(Number(plant_sequence_length));
    }
    if (defuse_sequence_length !== undefined) {
      sqlFields.push('defuse_sequence_length = ?');
      sqlValues.push(Number(defuse_sequence_length));
    }
    if (max_plant_errors !== undefined) {
      sqlFields.push('max_plant_errors = ?');
      sqlValues.push(Number(max_plant_errors));
    }
    if (max_defuse_errors !== undefined) {
      sqlFields.push('max_defuse_errors = ?');
      sqlValues.push(Number(max_defuse_errors));
    }
    if (plant_timer_seconds !== undefined) {
      sqlFields.push('plant_timer_seconds = ?');
      sqlValues.push(Number(plant_timer_seconds));
    }
    if (defuse_timer_seconds !== undefined) {
      sqlFields.push('defuse_timer_seconds = ?');
      sqlValues.push(Number(defuse_timer_seconds));
    }
    if (arrow_time_seconds !== undefined) {
      sqlFields.push('arrow_time_seconds = ?');
      sqlValues.push(Number(arrow_time_seconds));
    }
    if (match_length_seconds !== undefined) {
      sqlFields.push('match_length_seconds = ?');
      sqlValues.push(Number(match_length_seconds));
    }

    if (sqlFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided' });
    }

    sqlValues.push(currentMatch.id);
    db.prepare(`UPDATE match SET ${sqlFields.join(', ')} WHERE id = ?`).run(...sqlValues);

    const matchState = getMatchState(db, currentMatch.id);
    io.emit('match:state', matchState);
    return res.json(matchState);
  });

  // POST /api/match/start — start the match (admin only)
  router.post('/start', verifyJWT, adminOnly, (req, res) => {
    const currentMatch = getCurrentMatch(db);
    if (!currentMatch) {
      return res.status(404).json({ error: 'No match in lobby' });
    }

    if (currentMatch.status !== 'lobby') {
      return res.status(400).json({ error: 'Match has already started' });
    }

    // Get all players in this match
    const allMatchPlayers = db.prepare('SELECT * FROM match_players WHERE match_id = ?').all(currentMatch.id);

    const terroristPlayers = allMatchPlayers.filter(player => player.team === 'terrorist');
    const counterTerroristPlayers = allMatchPlayers.filter(player => player.team === 'ct');

    if (terroristPlayers.length === 0) {
      return res.status(400).json({ error: 'No terrorists assigned to the match' });
    }
    if (counterTerroristPlayers.length === 0) {
      return res.status(400).json({ error: 'No counter-terrorists assigned to the match' });
    }

    // Randomly assign bomb holder if not already set
    let bombHolderId = currentMatch.bomb_holder_id;
    if (!bombHolderId) {
      const randomTerrorist = terroristPlayers[Math.floor(Math.random() * terroristPlayers.length)];
      bombHolderId = randomTerrorist.user_id;
    }

    const matchStartedAt = new Date();
    const matchEndAt = new Date(matchStartedAt.getTime() + currentMatch.match_length_seconds * 1000).toISOString();

    db.prepare(`
      UPDATE match
      SET status = 'active', bomb_holder_id = ?, match_end_time = ?
      WHERE id = ?
    `).run(bombHolderId, matchEndAt, currentMatch.id);

    startMatchTimer(currentMatch.id, currentMatch.match_length_seconds, io, db);

    const matchState = getMatchState(db, currentMatch.id);

    io.emit('match:started', matchState);
    io.emit('match:state', matchState);
    io.emit('game:notification', {
      title: '🟢 Match Started',
      body: 'Check the app — your role has been assigned.',
    });

    return res.json(matchState);
  });

  // POST /api/match/reset — delete current match (admin only)
  router.post('/reset', verifyJWT, adminOnly, (req, res) => {
    const latestMatch = db.prepare('SELECT * FROM match ORDER BY id DESC LIMIT 1').get();

    if (latestMatch) {
      // Clear timers if running
      clearBombTimer();
      clearMatchTimer();
      // Clear any in-memory sequences
      clearAllSequencesForMatch(latestMatch.id);
      // Delete players first (FK constraint)
      db.prepare('DELETE FROM match_players WHERE match_id = ?').run(latestMatch.id);
      db.prepare('DELETE FROM sequence_attempts WHERE match_id = ?').run(latestMatch.id);
      db.prepare('DELETE FROM match WHERE id = ?').run(latestMatch.id);
    }

    io.emit('match:state', null);
    return res.json({ success: true });
  });

  return router;
}

module.exports = createMatchRouter;
