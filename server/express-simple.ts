/**
 * A simpler Express server setup that skips migrations for faster startup
 */
import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { storage } from "./storage";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";
import { serveStatic } from "./vite";
import "dotenv/config";
import type { Request, Response, NextFunction } from "express";

const app = express();

// Basic Express setup
app.use(bodyParser.json());
app.use(cookieParser());

// Set up authentication
setupAuth(app);

// Set up API routes
registerRoutes(app).then((server) => {
  // In development mode, don't try to serve static files
  // This will be handled by the Vite dev server

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  });

  // Start the server
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});