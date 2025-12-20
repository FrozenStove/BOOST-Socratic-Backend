import { CHROMA_DB_URL } from '../constants';
import { ChromaClient } from 'chromadb';

let chromaClient: ChromaClient | null = null;
let isInitialized = false;

export const initializeChromaDB = async () => {
    if (!CHROMA_DB_URL) {
        throw new Error('CHROMA_DB_URL not configured');
    }

    const maxRetries = 10;
    const retryDelay = 3000; // 3 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // ChromaClient accepts URL directly for remote servers
            chromaClient = new ChromaClient({
                path: CHROMA_DB_URL.startsWith('http') ? CHROMA_DB_URL : `http://${CHROMA_DB_URL}`
            });

            // Test the connection
            await chromaClient.heartbeat();
            isInitialized = true;
            console.log('ChromaDB initialized successfully');
            return;
        } catch (error) {
            if (attempt === maxRetries) {
                console.error(`Failed to initialize ChromaDB after ${maxRetries} attempts:`, error);
                chromaClient = null;
                isInitialized = false;
                throw error;
            }
            console.log(`ChromaDB connection attempt ${attempt}/${maxRetries} failed, retrying in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
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