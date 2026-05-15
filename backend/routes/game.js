'use strict';

const express = require('express');
const { db } = require('../db/database');
const { verifyJWT } = require('../middleware/auth');
const {
  getMatchState,
  getCurrentMatch,
  generateSequence,
  storeSequence,
  consumeSequence,
  clearSequence,
  startBombTimer,
  clearBombTimer,
  clearMatchTimer,
  checkAllDeadWin,
} = require('../services/gameService');

function createGameRouter(io) {
  const router = express.Router();

  // All game routes require authentication
  router.use(verifyJWT);

  // POST /api/game/plant/start — generate plant sequence, return to bomb holder
  router.post('/plant/start', (req, res) => {
    const currentMatch = getCurrentMatch(db);
    if (!currentMatch) {
      return res.status(404).json({ error: 'No active match found' });
    }

    if (currentMatch.status !== 'active') {
      return res.status(400).json({ error: 'Match is not in active state' });
    }

    if (currentMatch.bomb_holder_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not the bomb holder' });
    }

    // Clear any existing sequence for this user/match
    clearSequence(currentMatch.id, req.user.id, 'plant');

    const plantSequence = generateSequence(currentMatch.plant_sequence_length);
    storeSequence(currentMatch.id, req.user.id, 'plant', plantSequence);

    return res.json({ sequence: plantSequence });
  });

  // POST /api/game/plant/complete — bomb holder completed the sequence
  router.post('/plant/complete', (req, res) => {
    const { errors } = req.body;

    if (errors === undefined || errors === null) {
      return res.status(400).json({ error: 'errors field is required' });
    }

    const currentMatch = getCurrentMatch(db);
    if (!currentMatch) {
      return res.status(404).json({ error: 'No active match found' });
    }

    if (currentMatch.status !== 'active') {
      return res.status(400).json({ error: 'Match is not in active state' });
    }

    if (currentMatch.bomb_holder_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not the bomb holder' });
    }

    const errorCount = Number(errors);
    const plantSucceeded = errorCount <= currentMatch.max_plant_errors;

    // Record the attempt
    db.prepare(`
      INSERT INTO sequence_attempts (match_id, user_id, type, success, errors)
      VALUES (?, ?, 'plant', ?, ?)
    `).run(currentMatch.id, req.user.id, plantSucceeded ? 1 : 0, errorCount);

    // Clear the in-memory sequence
    consumeSequence(currentMatch.id, req.user.id, 'plant');

    if (!plantSucceeded) {
      return res.status(400).json({ error: 'Too many errors — plant failed', success: false });
    }

    // Calculate explode time
    const plantCompletedAt = new Date();
    const bombExplodeAt = new Date(plantCompletedAt.getTime() + currentMatch.bomb_timer_seconds * 1000).toISOString();

    // Update match to planted
    db.prepare(`
      UPDATE match
      SET status = 'planted', plant_start_time = ?, bomb_explode_time = ?
      WHERE id = ?
    `).run(plantCompletedAt.toISOString(), bombExplodeAt, currentMatch.id);

    // Emit events
    const matchState = getMatchState(db, currentMatch.id);
    io.emit('match:planted', { explode_at: bombExplodeAt });
    io.emit('match:state', matchState);
    io.emit('game:notification', {
      title: '💣 BOMB PLANTED',
      body: 'Defuse it before time runs out!',
    });

    // Bomb is planted — stop the match timer and start the bomb timer
    clearMatchTimer();
    startBombTimer(currentMatch.id, currentMatch.bomb_timer_seconds, io, db);

    return res.json({ success: true, explode_at: bombExplodeAt });
  });

  // POST /api/game/defuse/start — generate defuse sequence for any alive CT
  router.post('/defuse/start', (req, res) => {
    const currentMatch = getCurrentMatch(db);
    if (!currentMatch) {
      return res.status(404).json({ error: 'No active match found' });
    }

    if (currentMatch.status !== 'planted') {
      return res.status(400).json({ error: 'Bomb has not been planted yet' });
    }

    const defusingPlayer = db.prepare(
      'SELECT * FROM match_players WHERE match_id = ? AND user_id = ?'
    ).get(currentMatch.id, req.user.id);

    if (!defusingPlayer || defusingPlayer.team !== 'ct') {
      return res.status(403).json({ error: 'Only Counter-Terrorists can defuse the bomb' });
    }

    if (!defusingPlayer.is_alive) {
      return res.status(403).json({ error: 'Dead players cannot defuse the bomb' });
    }

    // Clear any existing sequence
    clearSequence(currentMatch.id, req.user.id, 'defuse');

    const defuseSequence = generateSequence(currentMatch.defuse_sequence_length);
    storeSequence(currentMatch.id, req.user.id, 'defuse', defuseSequence);

    return res.json({ sequence: defuseSequence });
  });

  // POST /api/game/defuse/complete — CT completed the defuse sequence
  router.post('/defuse/complete', (req, res) => {
    const { errors } = req.body;

    if (errors === undefined || errors === null) {
      return res.status(400).json({ error: 'errors field is required' });
    }

    const currentMatch = getCurrentMatch(db);
    if (!currentMatch) {
      return res.status(404).json({ error: 'No active match found' });
    }

    if (currentMatch.status !== 'planted') {
      return res.status(400).json({ error: 'Bomb has not been planted' });
    }

    const defusingPlayer = db.prepare(
      'SELECT * FROM match_players WHERE match_id = ? AND user_id = ?'
    ).get(currentMatch.id, req.user.id);

    if (!defusingPlayer || defusingPlayer.team !== 'ct') {
      return res.status(403).json({ error: 'Only Counter-Terrorists can defuse the bomb' });
    }

    if (!defusingPlayer.is_alive) {
      return res.status(403).json({ error: 'Dead players cannot defuse the bomb' });
    }

    const errorCount = Number(errors);
    const defuseSucceeded = errorCount <= currentMatch.max_defuse_errors;

    // Record the attempt
    db.prepare(`
      INSERT INTO sequence_attempts (match_id, user_id, type, success, errors)
      VALUES (?, ?, 'defuse', ?, ?)
    `).run(currentMatch.id, req.user.id, defuseSucceeded ? 1 : 0, errorCount);

    // Clear the in-memory sequence
    consumeSequence(currentMatch.id, req.user.id, 'defuse');

    if (!defuseSucceeded) {
      return res.status(400).json({ error: 'Too many errors — defuse failed', success: false });
    }

    // Clear bomb timer
    clearBombTimer();

    // Update match to defused
    db.prepare(`
      UPDATE match SET status = 'defused', winner_team = 'ct' WHERE id = ?
    `).run(currentMatch.id);

    const matchState = getMatchState(db, currentMatch.id);
    io.emit('match:defused', { winner: 'ct' });
    io.emit('match:state', matchState);
    io.emit('game:notification', {
      title: '✅ Bomb Defused',
      body: 'Counter-Terrorists win!',
    });

    return res.json({ success: true });
  });

  // POST /api/game/mark-dead — player marks themselves as dead
  router.post('/mark-dead', (req, res) => {
    const currentMatch = getCurrentMatch(db);
    if (!currentMatch) {
      return res.status(404).json({ error: 'No active match found' });
    }

    if (!['active', 'planted'].includes(currentMatch.status)) {
      return res.status(400).json({ error: 'Match is not in progress' });
    }

    const dbResult = db.prepare(
      'UPDATE match_players SET is_alive = 0 WHERE match_id = ? AND user_id = ?'
    ).run(currentMatch.id, req.user.id);

    if (dbResult.changes === 0) {
      return res.status(404).json({ error: 'You are not in this match' });
    }

    const ended = checkAllDeadWin(currentMatch.id, io, db);
    if (!ended) {
      const matchState = getMatchState(db, currentMatch.id);
      io.emit('match:state', matchState);
    }
    return res.json({ success: true });
  });

  return router;
}

module.exports = createGameRouter;
