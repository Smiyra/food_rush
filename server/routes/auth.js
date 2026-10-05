// server/routes/auth.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fd_jwt_secret_2024_xK9pQ';

// Helper – verify token from Authorization header
function verifyToken(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

// ── POST /api/auth/register ─────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password, phone, role,
          restaurant_name, cuisine_type, address, city, description, image_url,
          vehicle_type, vehicle_number } = req.body;

  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'name, email, password and role are required' });

  const validRoles = ['customer', 'restaurant_owner', 'rider'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name,email,password,phone,role) VALUES (?,?,?,?,?)',
      [name, email, hashed, phone || null, role]
    );
    const userId = result.insertId;

    if (role === 'restaurant_owner') {
      if (!restaurant_name) return res.status(400).json({ error: 'restaurant_name is required' });
      await pool.query(
        `INSERT INTO restaurants (owner_id,name,cuisine_type,description,image_url,address,city)
         VALUES (?,?,?,?,?,?,?)`,
        [userId, restaurant_name, cuisine_type || null, description || null,
         image_url || null, address || null, city || 'City']
      );
    }
    if (role === 'rider') {
      await pool.query(
        'INSERT INTO riders (user_id,vehicle_type,vehicle_number) VALUES (?,?,?)',
        [userId, vehicle_type || 'motorcycle', vehicle_number || null]
      );
    }

    const [users] = await pool.query(
      'SELECT id,name,email,phone,role FROM users WHERE id=?', [userId]
    );
    const user  = users[0];
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ message: 'Registered successfully', user, token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/auth/login ────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email=?', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user  = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const { password: _, ...safeUser } = user;
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Login successful', user: safeUser, token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/auth/logout ───────────────────────────────────
router.post('/logout', (_req, res) => {
  // JWT is stateless – client just discards the token
  res.json({ message: 'Logged out' });
});

// ── GET /api/auth/me ────────────────────────────────────────
router.get('/me', async (req, res) => {
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const [rows] = await pool.query(
      'SELECT id,name,email,phone,role FROM users WHERE id=?', [payload.id]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
