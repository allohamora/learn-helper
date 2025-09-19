import "dotenv/config";
import z from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export const { NODE_ENV } = schema.parse(process.env);
