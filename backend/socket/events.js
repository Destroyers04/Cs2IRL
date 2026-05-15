'use strict';

const jwt = require('jsonwebtoken');
const { getMatchState } = require('../services/gameService');
const { db } = require('../db/database');

/**
 * Register all Socket.io server event handlers.
 * @param {import('socket.io').Server} io
 */
function registerSocketEvents(io) {
  io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);

    // player:join — client sends JWT token to register/re-register after reconnect
    socket.on('player:join', ({ token } = {}) => {
      if (!token) {
        console.log(`[SOCKET] player:join from ${socket.id} without token`);
        return;
      }

      try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        socket.data.user = decodedToken;
        console.log(`[SOCKET] player:join registered: ${decodedToken.username} (${socket.id})`);

        // Send the current match state to the newly joined client
        const latestMatch = db.prepare(
          `SELECT * FROM match ORDER BY id DESC LIMIT 1`
        ).get();

        if (latestMatch) {
          const matchState = getMatchState(db, latestMatch.id);
          socket.emit('match:state', matchState);
        } else {
          socket.emit('match:state', null);
        }
      } catch (tokenError) {
        console.log(`[SOCKET] player:join invalid token from ${socket.id}: ${tokenError.message}`);
      }
    });

    socket.on('disconnect', (reason) => {
      const disconnectedUsername = socket.data.user ? socket.data.user.username : 'unknown';
      console.log(`[SOCKET] Client disconnected: ${disconnectedUsername} (${socket.id}) — ${reason}`);
    });

    socket.on('error', (socketError) => {
      console.error(`[SOCKET] Error from ${socket.id}:`, socketError);
    });
  });
}

module.exports = { registerSocketEvents };
