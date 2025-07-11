import { Router } from 'express';
import { z } from 'zod';
import { OpenAI } from 'openai';
import { getChromaClient } from '../services/chroma';
import { OpenAIEmbeddingFunction } from 'chromadb';
import { OPENAI_API_KEY } from '../constants';

const chatRouter = Router();

if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
}

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

const embeddingFunction = new OpenAIEmbeddingFunction({
    openai_api_key: OPENAI_API_KEY,
    openai_model: 'text-embedding-ada-002'
});

const chatRequestSchema = z.object({
    message: z.string().min(1),
    context: z.array(z.string()).optional()
});

chatRouter.post('/', async (req, res) => {
    try {
        const { message, context } = chatRequestSchema.parse(req.body);

        // Get relevant documents from ChromaDB
        const chromaClient = getChromaClient();
        const collection = await chromaClient.getCollection({
            name: 'medical_articles',
            embeddingFunction
        });

        // Query the vector database
        const results = await collection.query({
            queryTexts: [message],
            nResults: 3
        });

        // Prepare context from retrieved documents
        const contextText = results.documents[0].join('\n\n');

        // Generate response using OpenAI
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are a medical education assistant specializing in radiation oncology. Use the provided context to give accurate and educational responses."
                },
                {
                    role: "user",
                    content: `Context: ${contextText}\n\nQuestion: ${message}`
                }
            ],
            temperature: 0.7,
        });

        res.json({
            response: completion.choices[0].message.content,
            context: results.documents[0]
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to process chat request' });
    }
});

export default chatRouter; 