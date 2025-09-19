import "dotenv/config";
import z from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PINO_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
});

export const { NODE_ENV, PINO_LEVEL } = schema.parse(process.env);
