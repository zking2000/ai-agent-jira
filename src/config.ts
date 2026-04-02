import "dotenv/config";
import { OutputMode, RenderFormat } from "./types/ticket.js";

export interface AppConfig {
  llmProvider: "openai" | "mock";
  llmApiKey?: string;
  llmModel: string;
  llmBaseUrl?: string;
  defaultOutputMode: OutputMode;
  defaultFormat: RenderFormat;
  logLevel: string;
}

export const config: AppConfig = {
  llmProvider: (process.env.LLM_PROVIDER as AppConfig["llmProvider"]) || "mock",
  llmApiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY,
  llmModel: process.env.LLM_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
  llmBaseUrl: process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL,
  defaultOutputMode: (process.env.DEFAULT_OUTPUT_MODE as OutputMode) || "standard",
  defaultFormat: (process.env.DEFAULT_FORMAT as RenderFormat) || "markdown",
  logLevel: process.env.LOG_LEVEL || "info",
};
