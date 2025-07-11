import dotenv from 'dotenv';
import path from 'path';
import config from 'config';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

export const OPENAI_API_KEY: string = process.env.OPENAI_API_KEY || "";
export const CHROMA_DB_URL: string = config.get('chromaDbUrl') || "";

if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
}

if (!CHROMA_DB_URL) {
    throw new Error('CHROMA_DB_URL is not set in environment variables');
}
