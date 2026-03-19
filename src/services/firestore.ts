import * as admin from 'firebase-admin';
import { Firestore, FieldValue } from 'firebase-admin/firestore';

const ARTICLES_COLLECTION = 'medical_articles';
const USERS_COLLECTION = 'users';
const CHATS_COLLECTION = 'chats';

let db: Firestore | null = null;
let isInitialized = false;

export interface UserRecord {
    uid: string;
    email: string;
    displayName?: string;
    createdAt: FirebaseFirestore.Timestamp;
}

export interface ChatRecord {
    userId: string;
    input: string;
    response: string;
    createdAt: FirebaseFirestore.Timestamp;
}

export interface ArticleChunk {
    id: string;
    content: string;
    source: string;
    category: string;
    format: string;
    embedding: number[];
}

/**
 * Initialize Firebase Admin SDK and Firestore.
 * Uses Application Default Credentials (ADC) — works automatically on
 * Cloud Run and locally when GOOGLE_APPLICATION_CREDENTIALS is set.
 */
export const initializeFirestore = async (): Promise<void> => {
    if (isInitialized) return;

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
        });
    }

    db = admin.firestore();

    // Verify connectivity
    await db.listCollections();

    isInitialized = true;
    console.log('Firestore initialized successfully');
};

export const getFirestore = (): Firestore => {
    if (!db || !isInitialized) {
        throw new Error('Firestore not initialized. Call initializeFirestore() first.');
    }
    return db;
};

export const isFirestoreAvailable = (): boolean => isInitialized && db !== null;

// ---------------------------------------------------------------------------
// Vector search
// ---------------------------------------------------------------------------

/**
 * Query the medical_articles collection using Firestore vector search.
 * Returns the text content of the top N most similar chunks.
 */
export const queryVectors = async (
    queryEmbedding: number[],
    nResults: number = 3
): Promise<string[]> => {
    const firestore = getFirestore();
    const collection = firestore.collection(ARTICLES_COLLECTION);

    const vectorQuery = collection.findNearest({
        vectorField: 'embedding',
        queryVector: FieldValue.vector(queryEmbedding),
        limit: nResults,
        distanceMeasure: 'COSINE',
    });

    const snapshot = await vectorQuery.get();
    return snapshot.docs.map(doc => doc.data().content as string);
};

/**
 * Upsert a single article chunk with its embedding vector.
 */
export const upsertArticleChunk = async (
    id: string,
    content: string,
    embedding: number[],
    metadata: { source: string; category: string; format: string }
): Promise<void> => {
    const firestore = getFirestore();
    await firestore.collection(ARTICLES_COLLECTION).doc(id).set({
        content,
        source: metadata.source,
        category: metadata.category,
        format: metadata.format,
        embedding: FieldValue.vector(embedding),
        updatedAt: FieldValue.serverTimestamp(),
    });
};

/**
 * Returns the total number of documents in the articles collection.
 */
export const getArticleCount = async (): Promise<number> => {
    const firestore = getFirestore();
    const snapshot = await firestore.collection(ARTICLES_COLLECTION).count().get();
    return snapshot.data().count;
};

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

/**
 * Get or create a Firestore user profile for a Firebase Auth UID.
 * Called on first login to ensure a profile document exists.
 */
export const getOrCreateUser = async (
    uid: string,
    email: string,
    displayName?: string
): Promise<UserRecord> => {
    const firestore = getFirestore();
    const ref = firestore.collection(USERS_COLLECTION).doc(uid);
    const doc = await ref.get();

    if (doc.exists) {
        return doc.data() as UserRecord;
    }

    const user: UserRecord = {
        uid,
        email,
        displayName,
        createdAt: admin.firestore.Timestamp.now(),
    };
    await ref.set(user);
    return user;
};

export const getUserById = async (uid: string): Promise<UserRecord | null> => {
    const firestore = getFirestore();
    const doc = await firestore.collection(USERS_COLLECTION).doc(uid).get();
    return doc.exists ? (doc.data() as UserRecord) : null;
};

// ---------------------------------------------------------------------------
// Chat logging
// ---------------------------------------------------------------------------

export const logChat = async (
    userId: string,
    input: string,
    response: string
): Promise<void> => {
    const firestore = getFirestore();
    await firestore.collection(CHATS_COLLECTION).add({
        userId,
        input,
        response,
        createdAt: FieldValue.serverTimestamp(),
    });
};
