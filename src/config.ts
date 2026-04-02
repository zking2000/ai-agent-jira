import "dotenv/config";
import { OutputMode, RenderFormat } from "./types/ticket.js";

export interface AppConfig {
  llmProvider: "openai" | "mock";
  llmApiKey?: string;
  llmModel: string;
  llmBaseUrl?: string;
  jiraBaseUrl?: string;
  jiraEmail?: string;
  jiraApiToken?: string;
  jiraProjectKey?: string;
  jiraDefaultAssigneeAccountId?: string;
  jiraEpicLinkFieldId?: string;
  jiraRoutingConfigPath: string;
  jiraRecordDir: string;
  jiraMetadataDir: string;
  defaultOutputMode: OutputMode;
  defaultFormat: RenderFormat;
  logLevel: string;
}

export const config: AppConfig = {
  llmProvider: (process.env.LLM_PROVIDER as AppConfig["llmProvider"]) || "mock",
  llmApiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY,
  llmModel: process.env.LLM_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
  llmBaseUrl: process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL,
  jiraBaseUrl: process.env.JIRA_BASE_URL,
  jiraEmail: process.env.JIRA_EMAIL,
  jiraApiToken: process.env.JIRA_API_TOKEN,
  jiraProjectKey: process.env.JIRA_PROJECT_KEY,
  jiraDefaultAssigneeAccountId: process.env.JIRA_DEFAULT_ASSIGNEE_ACCOUNT_ID,
  jiraEpicLinkFieldId: process.env.JIRA_EPIC_LINK_FIELD_ID,
  jiraRoutingConfigPath: process.env.JIRA_ROUTING_CONFIG || "config/jira-routing.json",
  jiraRecordDir: process.env.JIRA_RECORD_DIR || "data/jira-records",
  jiraMetadataDir: process.env.JIRA_METADATA_DIR || "data/jira-metadata",
  defaultOutputMode: (process.env.DEFAULT_OUTPUT_MODE as OutputMode) || "standard",
  defaultFormat: (process.env.DEFAULT_FORMAT as RenderFormat) || "markdown",
  logLevel: process.env.LOG_LEVEL || "info",
};
