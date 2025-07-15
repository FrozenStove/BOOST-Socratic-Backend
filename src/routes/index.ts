import { Express } from "express";
import chatRouter from "./chat";
import articlesRouter from "./articles";
import scriptsRouter, { verifyScriptsAuth } from "./scripts";
import { isChromaDBAvailable } from "../services/chroma";
import { isDatabaseAvailable } from "../services/database";

export const setupRoutes = (app: Express) => {
  // Health check endpoint
  app.get("/health", (req, res) => {
    const chromaAvailable = isChromaDBAvailable();
    const databaseAvailable = isDatabaseAvailable();

    if (!chromaAvailable || !databaseAvailable) {
      const reasons = [];
      if (!chromaAvailable) reasons.push("ChromaDB not available");
      if (!databaseAvailable) reasons.push("Database not available");

      return res.status(503).json({
        status: "unhealthy",
        reason: reasons.join(", "),
        timestamp: new Date().toISOString(),
      });
    }

    res
      .status(200)
      .json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  app.use("/api/chat", chatRouter);
  app.use("/api/articles", articlesRouter);
  app.use("/api/scripts", verifyScriptsAuth, scriptsRouter);
};
