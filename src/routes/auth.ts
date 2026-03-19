import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { getOrCreateUser } from '../services/firestore';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const authRouter = Router();

/**
 * GET /api/auth/me
 *
 * Verifies the Firebase ID token and returns (or creates) the user's
 * Firestore profile. The frontend calls this after Firebase Auth login
 * to ensure a profile document exists.
 */
authRouter.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const uid = req.userId!;
        const email = req.userEmail!;

        // In bypass mode, return a mock user
        if (uid === 'bypass-user-id') {
            res.json({ user: { uid, email, displayName: 'Demo User' } });
            return;
        }

        // Fetch the Firebase Auth record for displayName
        const firebaseUser = await admin.auth().getUser(uid);
        const user = await getOrCreateUser(uid, email, firebaseUser.displayName ?? undefined);

        res.json({ user });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user profile' });
    }
});

export default authRouter;
