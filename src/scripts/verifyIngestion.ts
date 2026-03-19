import dotenv from 'dotenv';
import path from 'path';
import { initializeFirestore, queryVectors, getArticleCount, getFirestore } from '../services/firestore';
import { generateEmbedding } from '../services/embeddings';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export interface VerificationResult {
    success: boolean;
    collectionName: string;
    documentCount: number;
    sampleDocuments: SampleDocument[];
    queryTest: QueryTestResult;
    errors: string[];
}

export interface SampleDocument {
    id: string;
    source?: string;
    format?: string;
    contentPreview: string;
}

export interface QueryTestResult {
    query: string;
    success: boolean;
    resultCount: number;
    bestMatchPreview: string;
    error?: string;
}

export async function verifyIngestion(): Promise<VerificationResult> {
    const result: VerificationResult = {
        success: false,
        collectionName: 'medical_articles',
        documentCount: 0,
        sampleDocuments: [],
        queryTest: {
            query: 'medical education',
            success: false,
            resultCount: 0,
            bestMatchPreview: ''
        },
        errors: []
    };

    try {
        await initializeFirestore();

        const count = await getArticleCount();
        result.documentCount = count;
        console.log(`Total documents in Firestore collection: ${count}`);

        // Fetch a sample of documents
        const firestore = getFirestore();
        const sample = await firestore.collection('medical_articles').limit(5).get();

        console.log('\nSample of ingested documents:');
        console.log('------------------------');

        sample.docs.forEach((doc, index) => {
            const data = doc.data();
            const sampleDoc: SampleDocument = {
                id: doc.id,
                source: data.source ?? 'N/A',
                format: data.format ?? 'N/A',
                contentPreview: (data.content as string)?.substring(0, 200) ?? 'No content'
            };

            result.sampleDocuments.push(sampleDoc);

            console.log(`\nDocument ${index + 1}:`);
            console.log(`ID: ${doc.id}`);
            console.log(`Source: ${sampleDoc.source}`);
            console.log(`Format: ${sampleDoc.format}`);
            console.log('Content Preview:');
            console.log(sampleDoc.contentPreview);
            console.log('------------------------');
        });

        // Test a vector query
        console.log('\nTesting vector query...');
        try {
            const queryEmbedding = await generateEmbedding(result.queryTest.query);
            const queryResults = await queryVectors(queryEmbedding, 1);

            result.queryTest.success = true;
            result.queryTest.resultCount = queryResults.length;
            result.queryTest.bestMatchPreview = queryResults[0]?.substring(0, 200) ?? 'No results found';

            console.log('\nQuery Test Result:');
            console.log('------------------------');
            console.log(`Query: "${result.queryTest.query}"`);
            console.log('Best match preview:');
            console.log(result.queryTest.bestMatchPreview);
        } catch (error: any) {
            const errorMsg = `Query test failed: ${error.message}`;
            console.error(errorMsg);
            result.queryTest.error = error.message;
            result.errors.push(errorMsg);
        }

        result.success = result.errors.length === 0;
        return result;

    } catch (error: any) {
        const errorMsg = `Error during verification: ${error.message}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
        result.success = false;
        return result;
    }
}
