import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

export interface AuthRequest extends Request {
    userId?: string;
    userEmail?: string;
}

const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true' || process.env.DISABLE_AUTH === '1';

export const authenticateToken = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    if (DISABLE_AUTH) {
        console.log('⚠️  AUTHENTICATION BYPASSED - DISABLE_AUTH is enabled');
        req.userId = 'bypass-user-id';
        req.userEmail = 'demo@example.com';
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

        const decoded = await admin.auth().verifyIdToken(token);

        req.userId = decoded.uid;
        req.userEmail = decoded.email;
        next();
    } catch (error) {
        res.status(403).json({ error: 'Invalid or expired token' });
    }
};
