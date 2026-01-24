import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getPrismaClient } from '../services/database';
import { JWT_SECRET } from '../middleware/auth';

const authRouter = Router();

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6)
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string()
});

// Register new user
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = registerSchema.parse(req.body);
    const prisma = getPrismaClient();
    
    if (!prisma) {
      res.status(503).json({ error: 'Database not available. Auth features are disabled.' });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      res.status(400).json({ error: 'Username already exists' });
      return;
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword
      },
      select: {
        id: true,
        username: true,
        createdAt: true
      }
    });

    // Generate JWT token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username
      },
      token
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const prisma = getPrismaClient();
    
    if (!prisma) {
      res.status(503).json({ error: 'Database not available. Auth features are disabled.' });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username
      },
      token
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Get current user (requires authentication)
authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const prisma = getPrismaClient();
    
    if (!prisma) {
      res.status(503).json({ error: 'Database not available. Auth features are disabled.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        createdAt: true
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(403).json({ error: 'Invalid token' });
      return;
    }
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default authRouter;
