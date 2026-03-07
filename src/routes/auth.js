const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

// Public config
router.get('/config', (req, res) => {
  res.json({ registrationEnabled: process.env.REGISTRATION_ENABLED !== 'false' });
});

// Register
router.post('/register', async (req, res) => {
  if (process.env.REGISTRATION_ENABLED === 'false') {
    return res.status(403).json({ error: 'Registration is disabled' });
  }
  try {
    const { username, password, email, name } = req.body;
    
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        email,
        name
      }
    });
    
    // Create default settings
    await prisma.settings.create({
      data: { userId: user.id }
    });
    
    req.session.userId = user.id;
    req.session.username = user.username;
    
    res.json({ id: user.id, username: user.username, name: user.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.userId = user.id;
    req.session.username = user.username;
    
    res.json({ id: user.id, username: user.username, name: user.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get current user
router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ id: req.session.userId, username: req.session.username });
});

module.exports = router;
