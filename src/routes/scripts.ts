import { NextFunction, Router, Request, Response } from 'express';
import { ingestArticles } from '../scripts/ingestArticles';
import { verifyIngestion } from '../scripts/verifyIngestion';
import { checkFirestore } from '../scripts/checkFirestore';
import { convertCheckResult, convertIngestResult, convertVerifyResult } from '../scripts/scriptUtils';

const scriptsRouter = Router();

// ---------------------------------------------------------------------------
// In-memory ingest job state
// Acceptable for a single-instance admin utility; state resets on redeploy.
// ---------------------------------------------------------------------------
type JobStatus = 'idle' | 'running' | 'done' | 'error';

interface IngestJob {
    status: JobStatus;
    startedAt: string;
    completedAt?: string;
    result?: ReturnType<typeof convertIngestResult>;
    error?: string;
}

let currentJob: IngestJob | null = null;

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

// Start ingest in the background and return 202 immediately.
// Callers should poll GET /api/scripts/ingest/status for completion.
scriptsRouter.get('/ingest', (req, res) => {
    if (currentJob?.status === 'running') {
        res.status(409).json({ error: 'Ingest already running', job: currentJob });
        return;
    }

    currentJob = { status: 'running', startedAt: new Date().toISOString() };

    // Fire-and-forget — do NOT await so the HTTP response is sent immediately
    ingestArticles()
        .then(result => {
            currentJob = {
                status: result.success ? 'done' : 'error',
                startedAt: currentJob!.startedAt,
                completedAt: new Date().toISOString(),
                result: convertIngestResult(result),
                error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
            };
            console.log('Ingest job completed:', currentJob.status);
        })
        .catch(error => {
            currentJob = {
                status: 'error',
                startedAt: currentJob!.startedAt,
                completedAt: new Date().toISOString(),
                error: error.message,
            };
            console.error('Ingest job failed:', error);
        });

    res.status(202).json({
        message: 'Ingest started in background',
        status: 'running',
        pollUrl: '/api/scripts/ingest/status',
    });
});

// Poll this endpoint to check ingest progress.
scriptsRouter.get('/ingest/status', (req, res) => {
    if (!currentJob) {
        res.status(200).json({ status: 'idle', message: 'No ingest job has been started yet' });
        return;
    }
    res.status(200).json(currentJob);
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
