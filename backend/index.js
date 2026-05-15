'use strict';

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const { initDb } = require('./db/database');

const authRouter = require('./routes/auth');
const createMatchRouter = require('./routes/match');
const createAdminRouter = require('./routes/admin');
const createGameRouter = require('./routes/game');
const { registerSocketEvents } = require('./socket/events');

const PORT = process.env.PORT || 3001;

// Initialize database
initDb();

// Create Express app + HTTP server
const app = express();
const httpServer = http.createServer(app);

// Create Socket.io server
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Make io available globally via app.locals if needed
app.locals.io = io;

// Mount routes
app.use('/api/auth', authRouter);
app.use('/api/match', createMatchRouter(io));
app.use('/api/admin', createAdminRouter(io));
app.use('/api/game', createGameRouter(io));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Register Socket.io events
registerSocketEvents(io);

// Start server
httpServer.listen(PORT, () => {
  console.log(`[SERVER] CS2 Bomb Sim backend running on port ${PORT}`);
  console.log(`[SERVER] Health check: http://localhost:${PORT}/health`);
});
