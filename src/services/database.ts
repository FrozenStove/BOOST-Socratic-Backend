import { PrismaClient } from "@prisma/client";
import config from "config";

let prisma: PrismaClient | null = null;

/**
 * Properly encode a component of a PostgreSQL connection string
 * Special characters in usernames, passwords, and database names need to be URL-encoded
 */
const encodeConnectionComponent = (component: string): string => {
  return encodeURIComponent(component);
};

/**
 * Construct a PostgreSQL connection URL with proper encoding
 */
const buildDatabaseUrl = (
  user: string,
  password: string,
  host: string,
  port: string,
  database: string
): string => {
  const encodedUser = encodeConnectionComponent(user);
  const encodedPassword = encodeConnectionComponent(password);
  const encodedDatabase = encodeConnectionComponent(database);
  
  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${encodedDatabase}`;
};

export const initializeDatabase = async (): Promise<void> => {
  // Skip database initialization if DISABLE_AUTH is enabled (bypass mode)
  const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true' || process.env.DISABLE_AUTH === '1';
  
  if (DISABLE_AUTH) {
    console.log('\n⚠️  DATABASE INITIALIZATION SKIPPED - DISABLE_AUTH is enabled');
    console.log('   Database features will be disabled in bypass mode');
    console.log('   Chat logs will not be saved to database\n');
    prisma = null;
    return;
  }

  console.log('\n🔍 Database Connection Debug Info:');
  console.log('=====================================');
  
  // Priority: DATABASE_URL env var > config file > construct from POSTGRES_* env vars
  let databaseUrl = process.env.DATABASE_URL;
  let source = 'DATABASE_URL environment variable';
  
  if (databaseUrl) {
    console.log(`✅ Found DATABASE_URL from: ${source}`);
    console.log(`   Source: Environment variable (possibly from launch.json or .env)`);
  } else {
    console.log(`⚠️  DATABASE_URL not found in environment variables`);
    
    try {
      databaseUrl = config.get<string>("database.url");
      source = 'config file (default.yml or local.yml)';
      console.log(`✅ Found database URL from: ${source}`);
    } catch (error) {
      console.log(`⚠️  Database URL not found in config file`);
      console.log(`   Attempting to construct from POSTGRES_* environment variables...`);
      
      // Config not found, try to construct from environment variables
      const postgresUser = process.env.POSTGRES_USER || "postgres";
      const postgresPassword = process.env.POSTGRES_PASSWORD || "postgres";
      const postgresDb = process.env.POSTGRES_DB || "postgres";
      const postgresHost = process.env.POSTGRES_HOST || "localhost";
      const postgresPort = process.env.POSTGRES_PORT || "5432";
      
      console.log(`   POSTGRES_USER: ${postgresUser}`);
      console.log(`   POSTGRES_PASSWORD: ${postgresPassword ? '***' + postgresPassword.slice(-2) : 'not set (using default: postgres)'}`);
      console.log(`   POSTGRES_DB: ${postgresDb}`);
      console.log(`   POSTGRES_HOST: ${postgresHost}`);
      console.log(`   POSTGRES_PORT: ${postgresPort}`);
      
      // Properly encode all components to handle special characters
      databaseUrl = buildDatabaseUrl(
        postgresUser,
        postgresPassword,
        postgresHost,
        postgresPort,
        postgresDb
      );
      source = 'constructed from POSTGRES_* environment variables';
      console.log(`✅ Constructed database URL from: ${source}`);
    }
  }

  if (!databaseUrl) {
    throw new Error("DATABASE_URL not configured");
  }

  // Extract password from URL for debugging (masked)
  const urlMatch = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (urlMatch) {
    const [, user, password, host, port, db] = urlMatch;
    const maskedPassword = password.length > 2 ? '***' + password.slice(-2) : '***';
    console.log(`\n📋 Connection Details:`);
    console.log(`   User: ${user}`);
    console.log(`   Password: ${maskedPassword} (length: ${password.length})`);
    console.log(`   Host: ${host}`);
    console.log(`   Port: ${port}`);
    console.log(`   Database: ${db}`);
    console.log(`   Source: ${source}`);
  }

  // Log the database URL (with password masked for security)
  const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@');
  console.log(`\n🔗 Connection String: ${maskedUrl}`);
  console.log('=====================================\n');

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
        // Add connection pooling and timeout settings
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      });

      // Test the connection with a timeout
      await Promise.race([
        prisma.$connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
        )
      ]);
      
      // Verify connection with a simple query
      await prisma.$queryRaw`SELECT 1`;
      
      console.log("Database initialized successfully");
      return;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      const errorCode = error?.code || 'N/A';
      
      console.log(`\n❌ Connection attempt ${attempt}/${maxRetries} failed`);
      console.log(`   Error Code: ${errorCode}`);
      console.log(`   Error Message: ${errorMessage}`);
      
      if (attempt === maxRetries) {
        console.error(`\n💥 Failed to initialize database after ${maxRetries} attempts`);
        console.error(`\n🔍 Debug Information:`);
        console.error(`   Connection String Source: ${source}`);
        console.error(`   Masked Connection String: ${maskedUrl}`);
        
        // Extract and show the actual password being used (masked)
        const urlMatch = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@/);
        if (urlMatch) {
          const [, user, password] = urlMatch;
          const maskedPassword = password.length > 4 ? password.substring(0, 2) + '***' + password.slice(-2) : '***';
          console.error(`   Username: ${user}`);
          console.error(`   Password (partial): ${maskedPassword} (full length: ${password.length} chars)`);
          console.error(`   Password URL-encoded: ${password !== decodeURIComponent(password) ? 'Yes' : 'No'}`);
        }
        
        // Provide helpful troubleshooting information
        if (errorMessage.includes('Authentication failed') || errorMessage.includes('P1000')) {
          console.error('\n💡 Troubleshooting tips for authentication failure:');
          console.error('   1. The password in your connection string may not match the database password');
          console.error('   2. Check your .env file in BOOST-Socratic-Infra/ for POSTGRES_PASSWORD');
          console.error('   3. Check launch.json DATABASE_URL (may override .env)');
          console.error('   4. Run: cd BOOST-Socratic-Infra && npm run local:db:reset-password');
          console.error('   5. Verify PostgreSQL is running: docker ps | grep postgres');
          console.error('   6. Special characters in passwords must be URL-encoded');
        }
        
        prisma = null;
        throw error;
      }
      console.log(`   Retrying in ${retryDelay}ms...\n`);
      if (prisma) {
        await prisma.$disconnect().catch(() => {});
        prisma = null;
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
};

export const getPrismaClient = (): PrismaClient | null => {
  // In bypass mode, return null instead of throwing
  const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true' || process.env.DISABLE_AUTH === '1';
  if (DISABLE_AUTH && !prisma) {
    return null;
  }
  
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
