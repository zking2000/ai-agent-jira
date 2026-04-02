import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { TicketFieldSet } from "../types/ticket.js";
import { JiraRouteDecision } from "./jira-routing.js";

export interface JiraCreateRecord {
  createdAt: string;
  sourceInput: string;
  issueKey: string;
  browseUrl: string;
  projectKey: string;
  issueType: string;
  summary: string;
  assigneeAccountId?: string;
  epicKey?: string;
  priorityName?: string;
  routeDecision: JiraRouteDecision;
  customFields?: Record<string, unknown>;
  ticket: TicketFieldSet;
}

export function saveJiraCreateRecord(record: JiraCreateRecord): string {
  const recordDir = path.isAbsolute(config.jiraRecordDir)
    ? config.jiraRecordDir
    : path.resolve(process.cwd(), config.jiraRecordDir);

  fs.mkdirSync(recordDir, { recursive: true });

  const month = record.createdAt.slice(0, 7);
  const filePath = path.join(recordDir, `${month}.jsonl`);
  fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, "utf8");

  return filePath;
}
