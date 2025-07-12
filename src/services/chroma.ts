import { CHROMA_DB_URL } from '../constants';
import { ChromaClient } from 'chromadb';

let chromaClient: ChromaClient | null = null;
let isInitialized = false;

export const initializeChromaDB = async () => {
    try {
        if (!CHROMA_DB_URL) {
            throw new Error('CHROMA_DB_URL not configured');
        }

        chromaClient = new ChromaClient({
            path: CHROMA_DB_URL
        });

        // Test the connection
        await chromaClient.heartbeat();
        isInitialized = true;
        console.log('ChromaDB initialized successfully');
    } catch (error) {
        console.error('Failed to initialize ChromaDB:', error);
        chromaClient = null;
        isInitialized = false;
        throw error; // Re-throw the error to cause startup failure
    }
};

export const getChromaClient = () => {
    if (!chromaClient || !isInitialized) {
        throw new Error('ChromaDB client not initialized or not available');
    }
    return chromaClient;
};

export const isChromaDBAvailable = () => {
    return isInitialized && chromaClient !== null;
}; 