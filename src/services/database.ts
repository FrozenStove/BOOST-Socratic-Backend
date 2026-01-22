import { PrismaClient } from "@prisma/client";
import config from "config";

let prisma: PrismaClient | null = null;

export const initializeDatabase = async (): Promise<void> => {
  // Priority: DATABASE_URL env var > config file > construct from POSTGRES_* env vars
  let databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    try {
      databaseUrl = config.get<string>("database.url");
    } catch (error) {
      // Config not found, try to construct from environment variables
      const postgresUser = process.env.POSTGRES_USER || "postgres";
      const postgresPassword = process.env.POSTGRES_PASSWORD || "postgres";
      const postgresDb = process.env.POSTGRES_DB || "postgres";
      const postgresHost = process.env.POSTGRES_HOST || "localhost";
      const postgresPort = process.env.POSTGRES_PORT || "5432";
      
      databaseUrl = `postgresql://${postgresUser}:${postgresPassword}@${postgresHost}:${postgresPort}/${postgresDb}`;
    }
  }

  if (!databaseUrl) {
    throw new Error("DATABASE_URL not configured");
  }

  // Log the database URL (with password masked for security)
  const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@');
  console.log(`Attempting to connect to database: ${maskedUrl}`);

  const maxRetries = 10;
  const retryDelay = 3000; // 3 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
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
      return;
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`Failed to initialize database after ${maxRetries} attempts:`, error);
        prisma = null;
        throw error;
      }
      console.log(`Database connection attempt ${attempt}/${maxRetries} failed, retrying in ${retryDelay}ms...`);
      if (prisma) {
        await prisma.$disconnect().catch(() => {});
        prisma = null;
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
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
