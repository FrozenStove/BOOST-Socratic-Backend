import { IngestResult } from './ingestArticles';
import { VerificationResult } from './verifyIngestion';
import { FirestoreCheckResult } from './checkFirestore';

export type ScriptName = 'ingest' | 'verify' | 'check';

export type ScriptResult = {
    scriptName: ScriptName;
    documentCount: number;
    successfulFiles: number;
    failedFiles: number;
    data: any;
    error?: string;
}

export function convertIngestResult(result: IngestResult): ScriptResult {
    return {
        scriptName: 'ingest',
        documentCount: result.totalChunks,
        successfulFiles: result.successfulFiles,
        failedFiles: result.failedFiles,
        data: {
            totalFiles: result.totalFiles,
            fileResults: result.fileResults,
            errors: result.errors
        },
        error: result.errors.length > 0 ? result.errors.join('; ') : undefined
    };
}

export function convertVerifyResult(result: VerificationResult): ScriptResult {
    return {
        scriptName: 'verify',
        documentCount: result.documentCount,
        successfulFiles: result.success ? 1 : 0,
        failedFiles: result.success ? 0 : 1,
        data: {
            collectionName: result.collectionName,
            sampleDocuments: result.sampleDocuments,
            queryTest: result.queryTest,
            errors: result.errors
        },
        error: result.errors.length > 0 ? result.errors.join('; ') : undefined
    };
}

export function convertCheckResult(result: FirestoreCheckResult): ScriptResult {
    const totalDocuments = result.collections.reduce((sum, c) => sum + c.documentCount, 0);

    return {
        scriptName: 'check',
        documentCount: totalDocuments,
        successfulFiles: result.success ? result.collections.length : 0,
        failedFiles: result.errors.length,
        data: {
            isAvailable: result.isAvailable,
            collections: result.collections,
            errors: result.errors
        },
        error: result.errors.length > 0 ? result.errors.join('; ') : undefined
    };
}
