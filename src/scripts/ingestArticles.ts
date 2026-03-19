import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import pdfParse from 'pdf-parse';
import { initializeFirestore, upsertArticleChunk } from '../services/firestore';
import { generateEmbedding } from '../services/embeddings';

console.log('Starting ingestion script...');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const ARTICLES_DIR = path.join(__dirname, '../../articles');
const CHUNK_SIZE = 1000; // Characters per chunk
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

// Types for structured results
export interface IngestResult {
    success: boolean;
    totalFiles: number;
    successfulFiles: number;
    failedFiles: number;
    totalChunks: number;
    errors: string[];
    fileResults: FileResult[];
}

export interface FileResult {
    filePath: string;
    success: boolean;
    chunks: number;
    error?: string;
    contentLength: number;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await getAllFiles(fullPath));
        } else if (entry.isFile() && !entry.name.startsWith('.')) {
            files.push(fullPath);
        }
    }

    return files;
}

async function chunkText(text: string): Promise<string[]> {
    const chunks: string[] = [];
    let currentChunk = '';

    const paragraphs = text.split(/\n\s*\n/);

    for (const paragraph of paragraphs) {
        if (currentChunk.length + paragraph.length > CHUNK_SIZE) {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = paragraph;
        } else {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }
    }

    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
}

async function readFileContent(filePath: string): Promise<string> {
    const fileExtension = path.extname(filePath).toLowerCase();

    if (fileExtension === '.pdf') {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
    } else if (['.txt', '.md'].includes(fileExtension)) {
        return fs.readFile(filePath, 'utf-8');
    } else {
        throw new Error(`Unsupported file type: ${fileExtension}`);
    }
}

async function upsertChunkWithRetry(
    id: string,
    content: string,
    embedding: number[],
    metadata: { source: string; category: string; format: string },
    retryCount = 0
): Promise<void> {
    try {
        await upsertArticleChunk(id, content, embedding, metadata);
    } catch (error: any) {
        if (retryCount < MAX_RETRIES) {
            console.log(`Upsert failed, retrying in ${RETRY_DELAY / 1000}s... (${retryCount + 1}/${MAX_RETRIES})`);
            await wait(RETRY_DELAY);
            return upsertChunkWithRetry(id, content, embedding, metadata, retryCount + 1);
        }
        throw error;
    }
}

export async function ingestArticles(): Promise<IngestResult> {
    const result: IngestResult = {
        success: false,
        totalFiles: 0,
        successfulFiles: 0,
        failedFiles: 0,
        totalChunks: 0,
        errors: [],
        fileResults: []
    };

    try {
        console.log('Initializing Firestore...');
        await initializeFirestore();

        console.log('Reading articles directory...');
        const files = await getAllFiles(ARTICLES_DIR);
        const supportedFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.pdf', '.txt', '.md'].includes(ext);
        });

        result.totalFiles = supportedFiles.length;
        console.log(`Found ${supportedFiles.length} supported files to process`);

        for (const filePath of supportedFiles) {
            const fileResult: FileResult = {
                filePath,
                success: false,
                chunks: 0,
                contentLength: 0
            };

            console.log(`\nProcessing ${filePath}...`);

            try {
                const content = await readFileContent(filePath);
                fileResult.contentLength = content.length;
                console.log(`Read ${content.length} characters`);

                const chunks = await chunkText(content);
                fileResult.chunks = chunks.length;
                console.log(`Created ${chunks.length} chunks`);

                const relativePath = path.relative(ARTICLES_DIR, filePath);
                const metadata = {
                    source: relativePath,
                    format: path.extname(filePath).slice(1),
                    category: path.dirname(relativePath)
                };

                console.log(`Generating embeddings and upserting ${chunks.length} chunks to Firestore...`);
                for (let i = 0; i < chunks.length; i++) {
                    const chunkId = `${relativePath}-${i}`;
                    const embedding = await generateEmbedding(chunks[i]);
                    await upsertChunkWithRetry(chunkId, chunks[i], embedding, metadata);
                }

                console.log(`Successfully ingested ${chunks.length} chunks from ${filePath}`);
                fileResult.success = true;
                result.successfulFiles++;
                result.totalChunks += chunks.length;
            } catch (error: any) {
                const errorMsg = `Error processing ${filePath}: ${error.message}`;
                console.error(errorMsg);
                fileResult.error = error.message;
                result.errors.push(errorMsg);
                result.failedFiles++;
            }

            result.fileResults.push(fileResult);
        }

        result.success = result.failedFiles === 0;

        console.log('\nIngestion Summary:');
        console.log(`Successfully processed ${result.successfulFiles} files`);
        console.log(`Failed files: ${result.failedFiles}`);
        console.log(`Total chunks ingested: ${result.totalChunks}`);

        return result;
    } catch (error: any) {
        const errorMsg = `Error during ingestion: ${error.message}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
        result.success = false;
        return result;
    }
}
