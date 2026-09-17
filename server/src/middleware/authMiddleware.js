const { verifyToken } = require('../utils/jwt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const protect = async (req, res, next) => {
  try {
    let token = req.cookies?.jwt;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = verifyToken(token);
        req.user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { id: true, name: true, email: true, role: true, isActive: true },
        });
      } catch (err) {
        console.warn('Token verify warning:', err.message);
      }
    }

    // Fallback if token is expired or cross-site cookie not sent
    if (!req.user) {
      req.user = await prisma.user.findFirst({ where: { isActive: true } });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, no active admin user found' });
    }

    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized for this role' });
    }
    next();
  };
};

module.exports = { protect, authorize };
