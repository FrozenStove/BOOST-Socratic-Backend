import { GoogleGenAI } from '@google/genai';
import { GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION } from '../constants';

const EMBEDDING_MODEL = 'text-embedding-004';

let genAI: GoogleGenAI | null = null;

const getGenAI = (): GoogleGenAI => {
    if (!genAI) {
        genAI = new GoogleGenAI({
            vertexai: true,
            project: GOOGLE_CLOUD_PROJECT,
            location: GOOGLE_CLOUD_LOCATION,
        });
    }
    return genAI;
};

/**
 * Generate a 768-dimensional embedding vector for the given text
 * using Vertex AI text-embedding-004.
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
    const ai = getGenAI();
    let result;
    try {
        result = await ai.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: text,
        });
    } catch (error: any) {
        // The SDK parses responses as JSON; an XML body means an HTTP error
        // page (e.g. 429 rate-limit or 403 auth) was returned instead.
        if (
            error?.message?.includes('<?xml') ||
            error?.message?.includes("Unexpected token '<'") ||
            error?.message?.includes('is not valid JSON')
        ) {
            throw new Error(
                'Vertex AI returned an XML error response — this is usually a rate-limit (429) or ' +
                'auth/permissions error (403). Ensure the Vertex AI API is enabled and the service ' +
                'account has the aiplatform.user role. Original: ' + error.message
            );
        }
        throw error;
    }
    const values = result.embeddings?.[0]?.values;
    if (!values) {
        throw new Error('No embedding values returned from Vertex AI');
    }
    return values;
};

/**
 * Generate embeddings for multiple texts in sequence.
 */
export const generateEmbeddings = async (texts: string[]): Promise<number[][]> => {
    const embeddings: number[][] = [];
    for (const text of texts) {
        const embedding = await generateEmbedding(text);
        embeddings.push(embedding);
    }
    return embeddings;
};
