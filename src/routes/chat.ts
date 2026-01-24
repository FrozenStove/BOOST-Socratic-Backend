import { Router } from 'express';
import { z } from 'zod';
import { OpenAI } from 'openai';
import { getChromaClient } from '../services/chroma';
import { OpenAIEmbeddingFunction } from 'chromadb';
import { OPENAI_API_KEY } from '../constants';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { getPrismaClient } from '../services/database';

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
    conversation: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string()
    })).optional()
});

chatRouter.post('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { message, conversation } = chatRequestSchema.parse(req.body);
        const userId = req.userId!; // Guaranteed by authenticateToken middleware (or bypass)

        console.log('🔍 Querying ChromaDB for:', message.substring(0, 100) + '...');

        // Get relevant documents from ChromaDB
        // Use getOrCreateCollection to handle case where collection doesn't exist yet
        const chromaClient = getChromaClient();
        const collection = await chromaClient.getOrCreateCollection({
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

        const documents = results.documents?.[0] || [];
        const distances = results.distances?.[0];

        if (documents && documents.length > 0) {
            console.log('  - Retrieved documents count:', documents.length);
            console.log('  - First document preview:', documents[0]?.substring(0, 200) + '...');
            if (distances && distances.length > 0) {
                console.log('  - Similarity scores:', distances.map(d => (1 - d).toFixed(3)));
            }
        } else {
            console.log('  ⚠️ No documents found in results!');
            console.log('  💡 Tip: Run article ingestion to populate the knowledge base');
            console.log('     API: GET /api/scripts/ingest');
            console.log('     CLI: npm run ingest');
        }

        // Prepare context from retrieved documents
        const contextText = documents.length > 0 
            ? documents.join('\n\n') 
            : 'No relevant documents found in the knowledge base. The knowledge base may be empty - articles need to be ingested first.';

        // Build messages array with conversation history
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            {
                role: "system",
                content: DEFAULT_SYSTEM_PROMPT
            }
        ];

        // Add conversation history if provided
        if (conversation && conversation.length > 0) {
            // Add last 10 messages to avoid token limits
            const recentConversation = conversation.slice(-10);
            recentConversation.forEach(msg => {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                });
            });
        }

        // Add current query with context
        messages.push({
            role: "user",
            content: `Context from medical literature:\n${contextText}\n\nQuestion: ${message}`
        });

        // Generate response using OpenAI
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: messages,
            temperature: 0.7,
        });

        const response = completion.choices[0].message.content || '';
        console.log('✅ Response generated successfully, length:', response.length);

        // Save chat log to database (skip if in bypass mode or database unavailable)
        if (userId !== 'bypass-user-id') {
            const prisma = getPrismaClient();
            if (prisma) {
                try {
                    await prisma.chat.create({
                        data: {
                            userId: userId,
                            input: message,
                            response: response
                        }
                    });
                } catch (dbError) {
                    console.error('Failed to save chat log:', dbError);
                    // Don't fail the request if logging fails
                }
            }
        }

        res.json({
            response: response,
            context: documents
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to process chat request' });
    }
});

export default chatRouter; 