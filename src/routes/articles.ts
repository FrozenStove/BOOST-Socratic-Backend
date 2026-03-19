import { Router } from 'express';
import { z } from 'zod';
import { getFirestore, upsertArticleChunk, getArticleCount } from '../services/firestore';
import { generateEmbedding } from '../services/embeddings';

const articlesRouter = Router();

const articleSchema = z.object({
    title: z.string(),
    content: z.string(),
    metadata: z.record(z.string()).optional()
});

articlesRouter.post('/', async (req, res) => {
    try {
        const article = articleSchema.parse(req.body);
        const id = `manual-${Date.now()}`;
        const embedding = await generateEmbedding(article.content);

        await upsertArticleChunk(id, article.content, embedding, {
            source: article.title,
            category: 'manual',
            format: 'text'
        });

        res.status(201).json({ message: 'Article added successfully', id });
    } catch (error) {
        console.error('Error adding article:', error);
        res.status(500).json({ error: 'Failed to add article' });
    }
});

articlesRouter.get('/', async (req, res) => {
    try {
        const count = await getArticleCount();
        const firestore = getFirestore();
        const snapshot = await firestore.collection('medical_articles')
            .select('source', 'category', 'format', 'updatedAt')
            .limit(100)
            .get();

        const articles = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({ count, articles });
    } catch (error) {
        console.error('Error fetching articles:', error);
        res.status(500).json({ error: 'Failed to fetch articles' });
    }
});

export default articlesRouter;
