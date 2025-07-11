import { ChromaClient, IncludeEnum } from 'chromadb';
import { OpenAIEmbeddingFunction } from 'chromadb';
import dotenv from 'dotenv';
import path from 'path';
import { CHROMA_DB_URL } from '../constants';
import { OPENAI_API_KEY } from '../constants';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Types for structured results
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
        // Initialize ChromaDB client
        const chromaClient = new ChromaClient({
            path: CHROMA_DB_URL
        });

        // Initialize embedding function
        const embeddingFunction = new OpenAIEmbeddingFunction({
            openai_api_key: OPENAI_API_KEY,
            openai_model: 'text-embedding-ada-002'
        });

        // Get the collection
        const collection = await chromaClient.getCollection({
            name: 'medical_articles',
            embeddingFunction
        });

        // Get collection info
        const count = await collection.count();
        result.documentCount = count;
        console.log(`Total documents in collection: ${count}`);

        // Get a sample of documents
        const sample = await collection.get({
            limit: 5,
            include: [IncludeEnum.Metadatas, IncludeEnum.Documents]
        });

        console.log('\nSample of ingested documents:');
        console.log('------------------------');

        sample.ids.forEach((id, index) => {
            const sampleDoc: SampleDocument = {
                id,
                source: typeof sample.metadatas?.[index]?.source === 'string' ? sample.metadatas[index].source : 'N/A',
                format: typeof sample.metadatas?.[index]?.format === 'string' ? sample.metadatas[index].format : 'N/A',
                contentPreview: sample.documents?.[index]?.substring(0, 200) ?? 'No content available' + '...'
            };

            result.sampleDocuments.push(sampleDoc);

            console.log(`\nDocument ${index + 1}:`);
            console.log(`ID: ${id}`);
            console.log(`Source: ${sampleDoc.source}`);
            console.log(`Format: ${sampleDoc.format}`);
            console.log('Content Preview:');
            console.log(sampleDoc.contentPreview);
            console.log('------------------------');
        });

        // Test a simple query
        console.log('\nTesting a simple query...');
        try {
            const queryResult = await collection.query({
                queryTexts: [result.queryTest.query],
                nResults: 1
            });

            result.queryTest.success = true;
            result.queryTest.resultCount = queryResult.ids?.[0]?.length ?? 0;
            result.queryTest.bestMatchPreview = queryResult.documents?.[0]?.[0]?.substring(0, 200) ?? 'No results found' + '...';

            console.log('\nQuery Test Result:');
            console.log('------------------------');
            console.log('Query: "medical education"');
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

