import { Router } from 'express';
import { z } from 'zod';
import { OpenAI } from 'openai';
import { getChromaClient } from '../services/chroma';
import { OpenAIEmbeddingFunction } from 'chromadb';
import { OPENAI_API_KEY } from '../constants';

const chatRouter = Router();

const DEFAULT_SYSTEM_PROMPT = `You are a medical education assistant specializing in radiation oncology using the Socratic method. Your role is to:

1. Provide accurate, evidence-based information from the provided medical context
2. Explain complex medical concepts in clear, understandable terms
3. Always cite sources when possible from the provided context
4. Use the Socratic method to ask questions and guide the user to the answer
5. Use a professional yet approachable tone
6. Structure responses with clear headings and bullet points when appropriate
7. If the context doesn't contain relevant information, clearly state this and suggest alternative resources

When responding:
- Prioritize information from the provided context
- Be precise with medical terminology
- Include relevant statistics or data when available
- Suggest follow-up questions that might be helpful`;

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

        console.log('🔍 Querying ChromaDB for:', message.substring(0, 100) + '...');

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

        console.log('📊 ChromaDB Query Results:');
        console.log('  - Has documents:', !!results.documents);
        console.log('  - Documents array length:', results.documents?.length || 0);
        console.log('  - First document array length:', results.documents?.[0]?.length || 0);
        console.log('  - Has distances:', !!results.distances);
        console.log('  - Distances array length:', results.distances?.length || 0);

        const documents = results.documents?.[0];
        const distances = results.distances?.[0];

        if (documents && documents.length > 0) {
            console.log('  - Retrieved documents count:', documents.length);
            console.log('  - First document preview:', documents[0]?.substring(0, 200) + '...');
            if (distances && distances.length > 0) {
                console.log('  - Similarity scores:', distances.map(d => (1 - d).toFixed(3)));
            }
        } else {
            console.log('  ⚠️ No documents found in results!');
        }

        // Prepare context from retrieved documents
        const contextText = results.documents[0].join('\n\n');

        // Generate response using OpenAI
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: DEFAULT_SYSTEM_PROMPT
                    // "You are a medical education assistant specializing in radiation oncology. Use the provided context to give accurate and educational responses."
                },
                {
                    role: "user",
                    content: `Context: ${contextText}\n\nQuestion: ${message}`
                }
            ],
            temperature: 0.7,
        });

        const response = completion.choices[0].message.content;
        console.log('✅ Response generated successfully, length:', response?.length || 0);

        res.json({
            response: response,
            context: results.documents[0]
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to process chat request' });
    }
});

export default chatRouter; 