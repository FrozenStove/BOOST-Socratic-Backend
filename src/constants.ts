import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

export const OPENAI_API_KEY: string = process.env.OPENAI_API_KEY || "";
export const GOOGLE_CLOUD_PROJECT: string = process.env.GOOGLE_CLOUD_PROJECT || "ucsf-medical-education-app";
export const GOOGLE_CLOUD_LOCATION: string = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
}
