import { Router } from 'express';
import { z } from 'zod';
import { getChromaClient } from '../services/chroma';
import { IncludeEnum, OpenAIEmbeddingFunction } from 'chromadb';
import { OPENAI_API_KEY } from '../constants';

const articlesRouter = Router();

const articleSchema = z.object({
    title: z.string(),
    content: z.string(),
    metadata: z.record(z.string()).optional()
});

articlesRouter.post('/', async (req, res) => {
    try {
        const article = articleSchema.parse(req.body);
        const chromaClient = getChromaClient();
        const collection = await chromaClient.getCollection({
            name: 'medical_articles',
            embeddingFunction: new OpenAIEmbeddingFunction({
                openai_api_key: OPENAI_API_KEY,
                openai_model: 'text-embedding-ada-002'
            })
        });

        // Add document to collection
        await collection.add({
            ids: [Date.now().toString()],
            documents: [article.content],
            metadatas: [{
                title: article.title,
                ...article.metadata
            }]
        });

        res.status(201).json({ message: 'Article added successfully' });
    } catch (error) {
        console.error('Error adding article:', error);
        res.status(500).json({ error: 'Failed to add article' });
    }
});

articlesRouter.get('/', async (req, res) => {
    try {
        const chromaClient = getChromaClient();
        const collection = await chromaClient.getCollection({
            name: 'medical_articles',
            embeddingFunction: new OpenAIEmbeddingFunction({
                openai_api_key: OPENAI_API_KEY || '',
                openai_model: 'text-embedding-ada-002'
            })
        });

        const results = await collection.get({
            include: [IncludeEnum.Metadatas, IncludeEnum.Documents]
        });

        res.json(results);
    } catch (error) {
        console.error('Error fetching articles:', error);
        res.status(500).json({ error: 'Failed to fetch articles' });
    }
});

export default articlesRouter; 