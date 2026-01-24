import { Express } from "express";
import chatRouter from "./chat";
import articlesRouter from "./articles";
import scriptsRouter, { verifyScriptsAuth } from "./scripts";
import authRouter from "./auth";
import { isChromaDBAvailable } from "../services/chroma";
import { isDatabaseAvailable } from "../services/database";

export const setupRoutes = (app: Express) => {
  // Health check endpoint
  app.get("/health", (req, res) => {
    const chromaAvailable = isChromaDBAvailable();
    const databaseAvailable = isDatabaseAvailable();
    const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true' || process.env.DISABLE_AUTH === '1';

    // In bypass mode, database is optional
    if (!chromaAvailable) {
      return res.status(503).json({
        status: "unhealthy",
        reason: "ChromaDB not available",
        timestamp: new Date().toISOString(),
      });
    }

    if (!DISABLE_AUTH && !databaseAvailable) {
      return res.status(503).json({
        status: "unhealthy",
        reason: "Database not available",
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      bypassMode: DISABLE_AUTH || false
    });
  });

  // Auth routes (public)
  app.use("/api/auth", authRouter);
  
  // Protected routes
  app.use("/api/chat", chatRouter);
  app.use("/api/articles", articlesRouter);
  app.use("/api/scripts", verifyScriptsAuth, scriptsRouter);
};
