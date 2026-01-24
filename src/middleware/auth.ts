import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getPrismaClient } from '../services/database';

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    username: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true' || process.env.DISABLE_AUTH === '1';

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Bypass authentication if DISABLE_AUTH is set
  if (DISABLE_AUTH) {
    console.log('⚠️  AUTHENTICATION BYPASSED - DISABLE_AUTH is enabled');
    // Set a default user for bypass mode
    req.userId = 'bypass-user-id';
    req.user = {
      id: 'bypass-user-id',
      username: 'demo-user'
    };
    next();
    return;
  }

  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    // Verify user still exists
    const prisma = getPrismaClient();
    if (!prisma) {
      res.status(503).json({ error: 'Database not available' });
      return;
    }
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true }
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(403).json({ error: 'Invalid token' });
      return;
    }
    res.status(500).json({ error: 'Authentication error' });
  }
};

export { JWT_SECRET };
