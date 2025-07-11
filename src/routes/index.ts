import { Express } from "express";
import chatRouter from "./chat";
import articlesRouter from "./articles";
import scriptsRouter, { verifyScriptsAuth } from "./scripts";

export const setupRoutes = (app: Express) => {
  // Health check endpoint
  app.get("/health", (req, res) => {
    res
      .status(200)
      .json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  app.use("/api/chat", chatRouter);
  app.use("/api/articles", articlesRouter);
  app.use("/api/scripts", verifyScriptsAuth, scriptsRouter);
};
