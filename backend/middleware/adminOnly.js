'use strict';

function adminOnly(req, res, next) {
  if (!req.user || req.user.is_admin !== 1) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { adminOnly };
