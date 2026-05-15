'use strict';

const jwt = require('jsonwebtoken');

function verifyJWT(req, res, next) {
  const authorizationHeader = req.headers['authorization'];
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const bearerToken = authorizationHeader.slice(7);
  try {
    const decodedToken = jwt.verify(bearerToken, process.env.JWT_SECRET);
    req.user = decodedToken;
    next();
  } catch (jwtError) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { verifyJWT };
