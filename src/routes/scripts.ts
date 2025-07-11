import { NextFunction, Router, Request, Response } from 'express';
import { ingestArticles } from '../scripts/ingestArticles';
import { verifyIngestion } from '../scripts/verifyIngestion';
import { checkChroma } from '../scripts/checkChroma';
import { convertCheckResult, convertIngestResult, convertVerifyResult } from '../scripts/scriptUtils';

const scriptsRouter = Router();

export async function verifyScriptsAuth(req: Request, res: Response, next: NextFunction) {
    if (req.header('auth') !== "1234567890") {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

scriptsRouter.get('/ingest', async (req, res) => {
    try {
        const result = await ingestArticles();
        const scriptResult = convertIngestResult(result);
        res.status(200).json(scriptResult);
    } catch (error) {
        console.error('Error ingesting articles:', error);
        res.status(500).json({ error: 'Failed to ingest articles' });
    }
});

scriptsRouter.get('/verify', async (req, res) => {
    try {
        const result = await verifyIngestion();
        const scriptResult = convertVerifyResult(result);
        res.status(200).json(scriptResult);
    } catch (error) {
        console.error('Error verifying ingestion:', error);
        res.status(500).json({ error: 'Failed to verify ingestion' });
    }
});

scriptsRouter.get('/check', async (req, res) => {
    try {
        const result = await checkChroma();
        const scriptResult = convertCheckResult(result);
        res.status(200).json(scriptResult);
    } catch (error) {
        console.error('Error checking ChromaDB:', error);
        res.status(500).json({ error: 'Failed to check ChromaDB' });
    }
});

export default scriptsRouter; 