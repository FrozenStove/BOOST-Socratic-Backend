import { PrismaClient } from "@prisma/client";
import config from "config";

let prisma: PrismaClient | null = null;

export const initializeDatabase = async (): Promise<void> => {
  try {
    const databaseUrl = config.get<string>("database.url");

    if (!databaseUrl) {
      throw new Error("DATABASE_URL not configured");
    }

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });

    // Test the connection
    await prisma.$connect();
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    prisma = null;
    throw error;
  }
};

export const getPrismaClient = (): PrismaClient => {
  if (!prisma) {
    throw new Error(
      "Database not initialized. Call initializeDatabase() first."
    );
  }
  return prisma;
};

export const closeDatabase = async (): Promise<void> => {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
};

export const isDatabaseAvailable = (): boolean => {
  return prisma !== null;
};
