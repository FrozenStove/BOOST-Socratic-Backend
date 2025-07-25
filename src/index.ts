import express from "express";
import cors from "cors";
import { setupRoutes } from "./routes";
import { initializeChromaDB } from "./services/chroma";
import { initializeDatabase, closeDatabase } from "./services/database";
import config from "config";

const app = express();
const port = config.get("port") || 3010;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services (blocking - server won't start if services are unavailable)
Promise.all([initializeChromaDB(), initializeDatabase()]).catch((error) => {
  console.error("Failed to initialize services, shutting down:", error.message);
  process.exit(1);
});

// Setup routes
setupRoutes(app);

// Log all registered routes
console.log("\nRegistered Routes:");
app._router.stack.forEach((layer: any) => {
  if (layer.route) {
    const methods = Object.keys(layer.route.methods).join(", ").toUpperCase();
    console.log(`${methods} ${layer.route.path}`);
  } else if (layer.name === "router") {
    layer.handle.stack.forEach((route: any) => {
      if (route.route) {
        const methods = Object.keys(route.route.methods)
          .join(", ")
          .toUpperCase();
        const path = layer.regexp.source
          .replace("^\\/", "/")
          .replace("\\/?(?=\\/|$)", "")
          .replace(/\\\//g, "/");
        console.log(`${methods} ${path}${route.route.path}`);
      }
    });
  }
});

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong!" });
  }
);

app.listen(port, () => {
  console.log(`\nServer is running on port ${port}`);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`${signal} received, shutting down gracefully...`);
  try {
    await closeDatabase();
    console.log("Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});
