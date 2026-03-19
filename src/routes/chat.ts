import { Router } from 'express';
import { z } from 'zod';
import { OpenAI } from 'openai';
import { queryVectors, logChat } from '../services/firestore';
import { generateEmbedding } from '../services/embeddings';
import { OPENAI_API_KEY } from '../constants';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const chatRouter = Router();

/**
 * SOCRATIC TEACHING PROMPT
 *
 * This prompt configures the AI to act as a Socratic teaching partner rather than
 * a simple Q&A system. The model will:
 * - Ask probing questions instead of giving direct answers
 * - Guide learners to discover answers themselves
 * - Build on prior knowledge through questioning
 * - Encourage critical thinking and evidence-based reasoning
 *
 * To make responses more direct/less Socratic, modify this prompt or adjust
 * the user message format below.
 */
const DEFAULT_SYSTEM_PROMPT = `You are a Socratic teaching partner specializing in radiation oncology education. Your primary role is NOT to provide direct answers, but to guide learners through critical thinking by asking thoughtful questions.

CORE SOCRATIC PRINCIPLES:
1. **Question First, Answer Later**: When a learner asks a question, respond with 2-3 probing questions that help them discover the answer themselves. Only provide direct information after they've attempted to think through it.

2. **Build on Prior Knowledge**: Reference what the learner has already mentioned or understood, and build questions that connect new concepts to their existing knowledge.

3. **Gradual Revelation**: Break complex topics into smaller, manageable questions. Guide them step-by-step rather than overwhelming with information.

4. **Encourage Critical Thinking**: Ask "why" and "how" questions that require analysis, not just recall. Challenge assumptions and encourage evidence-based reasoning.

5. **Use the Medical Context Strategically**: When the learner struggles or asks for clarification, you may reference specific information from the provided medical literature context, but frame it as: "Based on the evidence, consider this..." rather than stating facts directly.

RESPONSE STRUCTURE:
- Start with 2-3 thoughtful questions that guide discovery
- If the learner seems stuck, provide a hint or partial information, then ask another question
- Only provide comprehensive answers after the learner has engaged with your questions
- End responses with a follow-up question that deepens understanding or explores related concepts

TONE:
- Supportive and encouraging, like a mentor
- Challenging but not condescending
- Curious and intellectually engaged
- Professional yet conversational

EXCEPTIONS:
- If the learner explicitly asks "just tell me" or "give me the answer directly," you may provide a direct answer, but still follow up with a question to deepen understanding
- For safety-critical information, provide direct answers but immediately follow with questions to ensure comprehension

Remember: Your goal is to develop the learner's thinking skills, not just transfer information. Make them work for understanding, but support them when they struggle.`;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

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
        const userId = req.userId!;

        console.log('🔍 Generating query embedding with Vertex AI...');
        const queryEmbedding = await generateEmbedding(message);

        console.log('🔍 Querying Firestore vector search for:', message.substring(0, 100) + '...');
        const documents = await queryVectors(queryEmbedding, 3);

        if (documents.length > 0) {
            console.log(`📊 Retrieved ${documents.length} documents from Firestore`);
            console.log('  - First document preview:', documents[0]?.substring(0, 200) + '...');
        } else {
            console.log('  ⚠️ No documents found in Firestore!');
            console.log('  💡 Tip: Run article ingestion to populate the knowledge base');
            console.log('     API: GET /api/scripts/ingest');
            console.log('     CLI: npm run ingest');
        }

        const contextText = documents.length > 0
            ? documents.join('\n\n')
            : 'No relevant documents found in the knowledge base. Articles need to be ingested first.';

        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: DEFAULT_SYSTEM_PROMPT }
        ];

        if (conversation && conversation.length > 0) {
            const recentConversation = conversation.slice(-10);
            recentConversation.forEach(msg => {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                });
            });
        }

        messages.push({
            role: 'user',
            content: `Medical Context Available:\n${contextText}\n\nLearner's Question: ${message}\n\nPlease respond using the Socratic method: ask guiding questions first to help the learner discover the answer, rather than providing it directly.`
        });

        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages,
            temperature: 0.75,
        });

        const response = completion.choices[0].message.content || '';
        console.log('✅ Response generated successfully, length:', response.length);

        // Log chat to Firestore (skip in bypass mode)
        if (userId !== 'bypass-user-id') {
            try {
                await logChat(userId, message, response);
            } catch (dbError) {
                console.error('Failed to save chat log:', dbError);
                // Don't fail the request if logging fails
            }
        }

        res.json({ response, context: documents });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to process chat request' });
    }
});

export default chatRouter;
