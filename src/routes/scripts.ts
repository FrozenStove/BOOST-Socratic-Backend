import { NextFunction, Router, Request, Response } from 'express';
import { ingestArticles } from '../scripts/ingestArticles';
import { verifyIngestion } from '../scripts/verifyIngestion';
import { checkFirestore } from '../scripts/checkFirestore';
import { convertCheckResult, convertIngestResult, convertVerifyResult } from '../scripts/scriptUtils';

const scriptsRouter = Router();

export async function verifyScriptsAuth(req: Request, res: Response, next: NextFunction) {
    const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true' || process.env.DISABLE_AUTH === '1';
    if (DISABLE_AUTH) {
        next();
        return;
    }

    if (req.header('auth') !== '1234567890') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

scriptsRouter.get('/ingest', async (req, res) => {
    try {
        const result = await ingestArticles();
        res.status(200).json(convertIngestResult(result));
    } catch (error) {
        console.error('Error ingesting articles:', error);
        res.status(500).json({ error: 'Failed to ingest articles' });
    }
});

scriptsRouter.get('/verify', async (req, res) => {
    try {
        const result = await verifyIngestion();
        res.status(200).json(convertVerifyResult(result));
    } catch (error) {
        console.error('Error verifying ingestion:', error);
        res.status(500).json({ error: 'Failed to verify ingestion' });
    }
});

scriptsRouter.get('/check', async (req, res) => {
    try {
        const result = await checkFirestore();
        res.status(200).json(convertCheckResult(result));
    } catch (error) {
        console.error('Error checking Firestore:', error);
        res.status(500).json({ error: 'Failed to check Firestore' });
    }
});

export default scriptsRouter;
