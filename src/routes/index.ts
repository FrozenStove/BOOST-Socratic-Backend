import { Express } from 'express';
import chatRouter from './chat';
import articlesRouter from './articles';
import scriptsRouter, { verifyScriptsAuth } from './scripts';
import authRouter from './auth';
import { isFirestoreAvailable } from '../services/firestore';

export const setupRoutes = (app: Express) => {
    app.get('/health', (req, res) => {
        const firestoreAvailable = isFirestoreAvailable();

        if (!firestoreAvailable) {
            return res.status(503).json({
                status: 'unhealthy',
                reason: 'Firestore not available',
                timestamp: new Date().toISOString(),
            });
        }

        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            bypassMode: process.env.DISABLE_AUTH === 'true' || false,
        });
    });

    app.use('/api/auth', authRouter);
    app.use('/api/chat', chatRouter);
    app.use('/api/articles', articlesRouter);
    app.use('/api/scripts', verifyScriptsAuth, scriptsRouter);
};
