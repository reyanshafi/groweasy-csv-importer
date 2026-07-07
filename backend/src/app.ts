import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { apiRouter } from "./routes/index.js";

export function createApp(): express.Express {
  const app = express();

  app.disable("x-powered-by");
  // Render/Railway/Vercel sit behind a proxy — trust it so req.ip is the real client.
  app.set("trust proxy", 1);
  app.use(
    cors({
      origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(","),
    }),
  );
  app.use(express.json());

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
