import { CHROMA_DB_URL } from '../constants';
import { ChromaClient } from 'chromadb';

let chromaClient: ChromaClient;

export const initializeChromaDB = async () => {
    try {
        chromaClient = new ChromaClient({
            path: CHROMA_DB_URL
        });
        console.log('ChromaDB initialized successfully');
    } catch (error) {
        console.error('Failed to initialize ChromaDB:', error);
        throw error;
    }
};

export const getChromaClient = () => {
    if (!chromaClient) {
        throw new Error('ChromaDB client not initialized');
    }
    return chromaClient;
}; 