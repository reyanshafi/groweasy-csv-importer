import { Router } from "express";
import multer from "multer";
import { importCsv } from "../controllers/import.controller.js";
import { importRateLimit } from "../middleware/rateLimit.js";
import { config } from "../config.js";
import { ApiError } from "../middleware/error.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const isCsv =
      /\.csv$/i.test(file.originalname) ||
      ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"].includes(
        file.mimetype,
      );
    if (isCsv) callback(null, true);
    else callback(new ApiError(415, "Only .csv files are supported."));
  },
});

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", model: config.geminiModel, aiConfigured: Boolean(config.geminiApiKey) });
});

apiRouter.post("/import", importRateLimit, upload.single("file"), importCsv);
