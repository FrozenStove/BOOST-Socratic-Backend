import { ChromaClient, IncludeEnum, OpenAIEmbeddingFunction } from 'chromadb';
import dotenv from 'dotenv';
import path from 'path';
import { CHROMA_DB_URL, OPENAI_API_KEY } from '../constants';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Types for structured results
export interface ChromaCheckResult {
    success: boolean;
    collections: CollectionInfo[];
    errors: string[];
}

export interface CollectionInfo {
    name: string;
    documentCount: number;
    sampleDocuments: SampleDocument[];
}

export interface SampleDocument {
    id: string;
    source?: string;
    contentPreview: string;
}

export async function checkChroma(): Promise<ChromaCheckResult> {
    const result: ChromaCheckResult = {
        success: false,
        collections: [],
        errors: []
    };

    try {
        console.log('Connecting to ChromaDB...');
        const client = new ChromaClient({
            path: CHROMA_DB_URL
        });

        // List all collections
        const collections = await client.listCollections();
        console.log('\nCollections:', collections);

        if (collections.length === 0) {
            console.log('No collections found in ChromaDB');
            result.success = true;
            return result;
        }

        // Check each collection
        for (const collectionName of collections) {
            console.log(`\nChecking collection: ${collectionName}`);

            try {
                const coll = await client.getCollection({
                    name: collectionName,
                    embeddingFunction: new OpenAIEmbeddingFunction({
                        openai_api_key: OPENAI_API_KEY,
                        openai_model: 'text-embedding-ada-002'
                    })
                });

                // Get count
                const count = await coll.count();
                console.log(`Total documents: ${count}`);

                const collectionInfo: CollectionInfo = {
                    name: collectionName,
                    documentCount: count,
                    sampleDocuments: []
                };

                if (count > 0) {
                    // Get a sample
                    const sample = await coll.get({
                        limit: 3,
                        include: [IncludeEnum.Metadatas, IncludeEnum.Documents]
                    });

                    console.log('\nSample documents:');
                    sample.ids.forEach((id, index) => {
                        const sampleDoc: SampleDocument = {
                            id,
                            source: typeof sample.metadatas?.[index]?.source === 'string' ? sample.metadatas[index].source : 'N/A',
                            contentPreview: sample.documents?.[index]?.substring(0, 200) ?? 'No content' + '...'
                        };

                        collectionInfo.sampleDocuments.push(sampleDoc);

                        console.log(`\nDocument ${index + 1}:`);
                        console.log(`ID: ${id}`);
                        console.log(`Source: ${sampleDoc.source}`);
                        console.log('Content Preview:');
                        console.log(sampleDoc.contentPreview);
                    });
                }

                result.collections.push(collectionInfo);
            } catch (error: any) {
                const errorMsg = `Error checking collection ${collectionName}: ${error.message}`;
                console.error(errorMsg);
                result.errors.push(errorMsg);
            }
        }

        result.success = result.errors.length === 0;
        return result;
    } catch (error: any) {
        const errorMsg = `Error checking ChromaDB: ${error.message}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
        result.success = false;
        return result;
    }
}