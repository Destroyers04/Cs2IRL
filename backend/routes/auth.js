'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const { db } = require('../db/database');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const matchedUser = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username);

  if (!matchedUser) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (matchedUser.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const signedToken = jwt.sign(
    { id: matchedUser.id, username: matchedUser.username, is_admin: matchedUser.is_admin },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return res.json({ token: signedToken });
});

module.exports = router;
