const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function requireAuth(req, res, next) {
  // 1. Session web
  if (req.session && req.session.userId) return next();

  // 2. Bearer token (mobile)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);

      // Verify tokenVersion to detect revoked tokens (e.g. after logout)
      const user = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { tokenVersion: true } });
      if (!user || decoded.v !== user.tokenVersion) {
        return res.status(401).json({ error: 'Token revoked' });
      }

      req.session = req.session || {};
      req.session.userId = decoded.userId;
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  return res.status(401).json({ error: 'Authentication required' });
}

module.exports = { requireAuth };
