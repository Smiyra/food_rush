// server/index.js — Express app entry point
const express = require('express');
const path    = require('path');

const authRoutes       = require('./routes/auth');
const restaurantRoutes = require('./routes/restaurants');
const orderRoutes      = require('./routes/orders');
const riderRoutes      = require('./routes/riders');
const reviewRoutes     = require('./routes/reviews');
const addressRoutes    = require('./routes/addresses');
const pool             = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// Trust Render's reverse proxy (needed for req.ip, secure cookies, etc.)
app.set('trust proxy', 1);

const { attachUser } = require('./middleware/auth');

// ── Middleware ──────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(attachUser); // populate req.user from JWT on every request

// Serve static frontend
app.use(express.static(path.join(__dirname, '../public')));

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/orders',      orderRoutes);
app.use('/api/rider',       riderRoutes);
app.use('/api/reviews',     reviewRoutes);
app.use('/api/addresses',   addressRoutes);

// Categories
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Health check for Render ─────────────────────────────────
app.get('/healthz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: err.message });
  }
});

// ── SPA fallback ────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n   Server running on port ${PORT}\n`);
});
