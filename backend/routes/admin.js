'use strict';

const express = require('express');
const { db } = require('../db/database');
const { verifyJWT } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminOnly');
const { getMatchState, getCurrentMatch, checkAllDeadWin } = require('../services/gameService');

function createAdminRouter(io) {
  const router = express.Router();

  // All admin routes require JWT + admin role
  router.use(verifyJWT, adminOnly);

  // POST /api/admin/assign-team — upsert player into match_players with a team
  router.post('/assign-team', (req, res) => {
    const { user_id, team } = req.body;

    if (!user_id || !team) {
      return res.status(400).json({ error: 'user_id and team are required' });
    }

    if (!['ct', 'terrorist'].includes(team)) {
      return res.status(400).json({ error: 'team must be "ct" or "terrorist"' });
    }

    const currentMatch = getCurrentMatch(db);
    if (!currentMatch) {
      return res.status(404).json({ error: 'No active match found' });
    }

    if (currentMatch.status !== 'lobby') {
      return res.status(400).json({ error: 'Cannot change teams after match has started' });
    }

    // Verify user exists
    const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    db.prepare(`
      INSERT INTO match_players (match_id, user_id, team, is_alive)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(match_id, user_id) DO UPDATE SET team = excluded.team
    `).run(currentMatch.id, user_id, team);

    const matchState = getMatchState(db, currentMatch.id);
    io.emit('match:state', matchState);
    return res.json(matchState);
  });

  // POST /api/admin/assign-bomb — manually set bomb_holder_id
  router.post('/assign-bomb', (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const currentMatch = getCurrentMatch(db);
    if (!currentMatch) {
      return res.status(404).json({ error: 'No active match found' });
    }

    if (currentMatch.status !== 'lobby') {
      return res.status(400).json({ error: 'Cannot assign bomb after match has started' });
    }

    // Verify user is a terrorist in this match
    const targetPlayer = db.prepare(
      'SELECT * FROM match_players WHERE match_id = ? AND user_id = ?'
    ).get(currentMatch.id, user_id);

    if (!targetPlayer) {
      return res.status(400).json({ error: 'User is not in this match' });
    }

    if (targetPlayer.team !== 'terrorist') {
      return res.status(400).json({ error: 'Bomb can only be assigned to a terrorist' });
    }

    db.prepare('UPDATE match SET bomb_holder_id = ? WHERE id = ?').run(user_id, currentMatch.id);

    const matchState = getMatchState(db, currentMatch.id);
    io.emit('match:state', matchState);
    return res.json(matchState);
  });

  // POST /api/admin/randomize-teams — shuffle all players into two teams in one transaction
  router.post('/randomize-teams', (req, res) => {
    const currentMatch = getCurrentMatch(db);
    if (!currentMatch) {
      return res.status(404).json({ error: 'No active match found' });
    }
    if (currentMatch.status !== 'lobby') {
      return res.status(400).json({ error: 'Cannot randomize teams after match has started' });
    }

    const allUsers = db.prepare('SELECT id FROM users').all();
    if (allUsers.length === 0) {
      return res.status(400).json({ error: 'No users found' });
    }

    const shuffled = [...allUsers].sort(() => Math.random() - 0.5);
    const half = Math.ceil(shuffled.length / 2);
    const upsertTeam = db.prepare(`
      INSERT INTO match_players (match_id, user_id, team, is_alive)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(match_id, user_id) DO UPDATE SET team = excluded.team
    `);

    db.transaction(() => {
      for (let i = 0; i < shuffled.length; i++) {
        upsertTeam.run(currentMatch.id, shuffled[i].id, i < half ? 'ct' : 'terrorist');
      }
    })();

    const matchState = getMatchState(db, currentMatch.id);
    io.emit('match:state', matchState);
    return res.json(matchState);
  });

  // POST /api/admin/kill-player — set is_alive = 0
  router.post('/kill-player', (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const currentMatch = getCurrentMatch(db);
    if (!currentMatch) {
      return res.status(404).json({ error: 'No active match found' });
    }

    const dbResult = db.prepare(
      'UPDATE match_players SET is_alive = 0 WHERE match_id = ? AND user_id = ?'
    ).run(currentMatch.id, user_id);

    if (dbResult.changes === 0) {
      return res.status(404).json({ error: 'Player not found in current match' });
    }

    const ended = checkAllDeadWin(currentMatch.id, io, db);
    if (!ended) {
      const matchState = getMatchState(db, currentMatch.id);
      io.emit('match:state', matchState);
    }
    return res.json(getMatchState(db, currentMatch.id));
  });

  // POST /api/admin/revive-player — set is_alive = 1
  router.post('/revive-player', (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const currentMatch = getCurrentMatch(db);
    if (!currentMatch) {
      return res.status(404).json({ error: 'No active match found' });
    }

    const dbResult = db.prepare(
      'UPDATE match_players SET is_alive = 1 WHERE match_id = ? AND user_id = ?'
    ).run(currentMatch.id, user_id);

    if (dbResult.changes === 0) {
      return res.status(404).json({ error: 'Player not found in current match' });
    }

    const matchState = getMatchState(db, currentMatch.id);
    io.emit('match:state', matchState);
    return res.json(matchState);
  });

  return router;
}

module.exports = createAdminRouter;
