import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { IssueType, TicketFieldSet } from "../types/ticket.js";

export interface JiraRoutingApply {
  projectKey?: string;
  assigneeAccountId?: string;
  assigneeDisplayName?: string;
  epicKey?: string;
  priorityName?: string;
  labels?: string[];
  components?: string[];
  customFields?: Record<string, unknown>;
}

interface JiraRoutingMatch {
  keywords?: string[];
  systems?: string[];
  issueTypes?: IssueType[];
  labels?: string[];
  priorities?: string[];
}

interface JiraRoutingRule {
  name: string;
  match?: JiraRoutingMatch;
  apply: JiraRoutingApply;
}

interface JiraRoutingConfig {
  defaults?: JiraRoutingApply;
  rules?: JiraRoutingRule[];
}

export interface JiraRouteDecision extends JiraRoutingApply {
  matchedRuleNames: string[];
  notes: string[];
}

function normalize(values?: string[]): string[] {
  return (values || []).map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function loadRoutingConfig(): JiraRoutingConfig {
  const filePath = path.isAbsolute(config.jiraRoutingConfigPath)
    ? config.jiraRoutingConfigPath
    : path.resolve(process.cwd(), config.jiraRoutingConfigPath);

  if (!fs.existsSync(filePath)) {
    return {
      defaults: {
        projectKey: config.jiraProjectKey,
        assigneeAccountId: config.jiraDefaultAssigneeAccountId,
      },
      rules: [],
    };
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as JiraRoutingConfig;

  return {
    defaults: {
      projectKey: config.jiraProjectKey,
      assigneeAccountId: config.jiraDefaultAssigneeAccountId,
      ...(parsed.defaults || {}),
    },
    rules: parsed.rules || [],
  };
}

function mergeApply(base: JiraRouteDecision, apply?: JiraRoutingApply): JiraRouteDecision {
  if (!apply) {
    return base;
  }

  return {
    ...base,
    ...apply,
    labels: unique([...(base.labels || []), ...(apply.labels || [])]),
    components: unique([...(base.components || []), ...(apply.components || [])]),
    customFields: {
      ...(base.customFields || {}),
      ...(apply.customFields || {}),
    },
  };
}

function matchRule(rule: JiraRoutingRule, ticket: TicketFieldSet, rawInput: string): { matched: boolean; score: number; reason: string[] } {
  const match = rule.match || {};
  const haystack = `${rawInput} ${ticket.summary} ${(ticket.description || "")}`.toLowerCase();
  const systems = normalize(ticket.componentsSuggestion);
  const labels = normalize(ticket.labelsSuggestion);
  const priority = (ticket.prioritySuggestion || "").toLowerCase();
  const reasons: string[] = [];
  let score = 0;
  let checked = 0;

  if (match.keywords && match.keywords.length > 0) {
    checked += 1;
    const hits = match.keywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
    if (hits.length === 0) {
      return { matched: false, score: 0, reason: [] };
    }
    score += hits.length * 3;
    reasons.push(`关键词命中: ${hits.join(", ")}`);
  }

  if (match.systems && match.systems.length > 0) {
    checked += 1;
    const hits = normalize(match.systems).filter((system) => systems.includes(system));
    if (hits.length === 0) {
      return { matched: false, score: 0, reason: [] };
    }
    score += hits.length * 4;
    reasons.push(`系统命中: ${hits.join(", ")}`);
  }

  if (match.issueTypes && match.issueTypes.length > 0) {
    checked += 1;
    if (!match.issueTypes.includes(ticket.issueType)) {
      return { matched: false, score: 0, reason: [] };
    }
    score += 3;
    reasons.push(`Issue Type 命中: ${ticket.issueType}`);
  }

  if (match.labels && match.labels.length > 0) {
    checked += 1;
    const hits = normalize(match.labels).filter((label) => labels.includes(label));
    if (hits.length === 0) {
      return { matched: false, score: 0, reason: [] };
    }
    score += hits.length * 2;
    reasons.push(`标签命中: ${hits.join(", ")}`);
  }

  if (match.priorities && match.priorities.length > 0) {
    checked += 1;
    const hits = normalize(match.priorities).filter((item) => item === priority);
    if (hits.length === 0) {
      return { matched: false, score: 0, reason: [] };
    }
    score += 1;
    reasons.push(`优先级命中: ${ticket.prioritySuggestion}`);
  }

  return {
    matched: checked > 0,
    score,
    reason: reasons,
  };
}

export function resolveJiraRoute(ticket: TicketFieldSet, rawInput: string): JiraRouteDecision {
  const routing = loadRoutingConfig();
  let decision: JiraRouteDecision = {
    projectKey: routing.defaults?.projectKey,
    assigneeAccountId: ticket.assigneeAccountIdSuggestion || routing.defaults?.assigneeAccountId,
    assigneeDisplayName: ticket.assigneeDisplayNameSuggestion || routing.defaults?.assigneeDisplayName,
    epicKey: ticket.epicSuggestion || routing.defaults?.epicKey,
    priorityName: ticket.prioritySuggestion || routing.defaults?.priorityName,
    labels: unique([...(ticket.labelsSuggestion || []), ...(routing.defaults?.labels || [])]),
    components: unique([...(ticket.componentsSuggestion || []), ...(routing.defaults?.components || [])]),
    customFields: {
      ...(routing.defaults?.customFields || {}),
      ...(ticket.customFieldSuggestions || {}),
    },
    matchedRuleNames: [],
    notes: [...(ticket.routingSuggestionNotes || [])],
  };

  const matches = (routing.rules || [])
    .map((rule, index) => ({ rule, index, result: matchRule(rule, ticket, rawInput) }))
    .filter((item) => item.result.matched)
    .sort((a, b) => a.result.score - b.result.score || a.index - b.index);

  for (const match of matches) {
    decision = mergeApply(decision, match.rule.apply);
    decision.matchedRuleNames.push(match.rule.name);
    decision.notes.push(`路由规则 ${match.rule.name}: ${match.result.reason.join("；")}`);
  }

  if (decision.assigneeAccountId && !decision.assigneeDisplayName) {
    decision.notes.push("assignee 由账号 ID 自动指定");
  }
  if (decision.epicKey && !config.jiraEpicLinkFieldId) {
    decision.notes.push("已推断 epicKey，但未配置 JIRA_EPIC_LINK_FIELD_ID，创建时不会自动写入 Epic Link。");
  }

  return decision;
}
