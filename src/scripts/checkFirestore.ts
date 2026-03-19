import dotenv from 'dotenv';
import path from 'path';
import { initializeFirestore, getArticleCount, isFirestoreAvailable } from '../services/firestore';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export interface FirestoreCheckResult {
    success: boolean;
    isAvailable: boolean;
    collections: CollectionInfo[];
    errors: string[];
}

export interface CollectionInfo {
    name: string;
    documentCount: number;
}

export async function checkFirestore(): Promise<FirestoreCheckResult> {
    const result: FirestoreCheckResult = {
        success: false,
        isAvailable: false,
        collections: [],
        errors: []
    };

    try {
        await initializeFirestore();
        result.isAvailable = isFirestoreAvailable();

        const articleCount = await getArticleCount();
        result.collections.push({
            name: 'medical_articles',
            documentCount: articleCount
        });

        console.log('Firestore Status:');
        console.log(`  Available: ${result.isAvailable}`);
        console.log(`  medical_articles: ${articleCount} documents`);

        result.success = true;
        return result;
    } catch (error: any) {
        const errorMsg = `Firestore check failed: ${error.message}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
        return result;
    }
}
