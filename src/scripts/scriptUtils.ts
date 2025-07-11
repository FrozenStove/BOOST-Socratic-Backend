import { IngestResult } from './ingestArticles';
import { VerificationResult } from './verifyIngestion';
import { ChromaCheckResult } from './checkChroma';

export type ScriptName = 'ingest' | 'verify' | 'check';

export type ScriptResult = {
    scriptName: ScriptName;
    documentCount: number;
    successfulFiles: number;
    failedFiles: number;
    data: any;
    error?: string;
}

/**
 * Converts IngestResult to unified ScriptResult
 */
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

/**
 * Converts VerificationResult to unified ScriptResult
 */
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

/**
 * Converts ChromaCheckResult to unified ScriptResult
 */
export function convertCheckResult(result: ChromaCheckResult): ScriptResult {
    const totalDocuments = result.collections.reduce((sum, collection) => sum + collection.documentCount, 0);
    const successfulCollections = result.collections.length;
    const failedCollections = result.errors.length;

    return {
        scriptName: 'check',
        documentCount: totalDocuments,
        successfulFiles: successfulCollections,
        failedFiles: failedCollections,
        data: {
            collections: result.collections,
            errors: result.errors
        },
        error: result.errors.length > 0 ? result.errors.join('; ') : undefined
    };
}
