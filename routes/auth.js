const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDbConnection } = require('../database');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  console.log('[Auth] Login attempt started for email:', email);

  if (!email || !password) {
    console.warn('[Auth] Login failed: Email or password not provided.');
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const db = await getDbConnection();
    
    // Log masked database connection string to verify what Vercel resolved
    const maskedUrl = process.env.DATABASE_URL 
      ? process.env.DATABASE_URL.replace(/:[^@]+@/, ':***@') 
      : 'UNDEFINED';
    console.log('[Auth] Using DATABASE_URL:', maskedUrl);
    
    console.log('[Auth] Querying "User" table...');
    const userRes = await db.query('SELECT * FROM "User" WHERE email = $1', [email.trim()]);
    const user = userRes.rows[0];

    if (!user) {
      console.warn('[Auth] Login failed: No user found in database with email:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log('[Auth] User record retrieved. Proceeding to verify password.');
    const isMatch = (password === user.password_hash);
    console.log('[Auth] Password matched:', isMatch);

    if (!isMatch) {
      console.warn('[Auth] Login failed: Password mismatch for user:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log('[Auth] Password verified. Signing JWT token.');
    // Sign JWT
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('[Auth] JWT token generated successfully. User logged in:', user.email);
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('[Auth] CRITICAL login handler error:', error.message);
    console.error('[Auth] Error Stack:', error.stack);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const db = await getDbConnection();
    const userRes = await db.query('SELECT id, name, email, role FROM "User" WHERE id = $1', [req.user.id]);
    const user = userRes.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (error) {
    console.error('Fetch me error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
