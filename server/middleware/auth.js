// server/middleware/auth.js — JWT auth middleware
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'fd_jwt_secret_2024_xK9pQ';

/**
 * Attaches req.user = { id, role } if a valid Bearer token is present.
 * Routes can then check req.user directly.
 */
function attachUser(req, _res, next) {
  const auth  = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); }
    catch { req.user = null; }
  } else {
    req.user = null;
  }
  next();
}

/**
 * Middleware factory – requires the user to be authenticated and have one of
 * the given roles. Call as: requireRole('customer'), requireRole('rider'), etc.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Login required' });
    if (roles.length && !roles.includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

module.exports = { attachUser, requireRole };
