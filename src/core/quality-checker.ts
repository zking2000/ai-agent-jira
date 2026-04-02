import { TicketFieldSet } from "../types/ticket.js";

export interface QualityCheckResult {
  warnings: string[];
  normalizedTicket: TicketFieldSet;
}

function normalizeAcceptanceCriteria(criteria: string[]): string[] {
  return criteria
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^-\s*/, ""));
}

function improveSummary(summary: string, issueType: TicketFieldSet["issueType"]): string {
  const clean = summary.trim();
  if (clean.length >= 12) {
    return clean;
  }

  const prefix = issueType === "Bug" ? "修复" : issueType === "Spike" ? "调研" : "处理";
  return `${prefix} ${clean}`;
}

export function qualityCheck(ticket: TicketFieldSet): QualityCheckResult {
  const warnings: string[] = [];
  const normalizedTicket: TicketFieldSet = {
    ...ticket,
    summary: improveSummary(ticket.summary, ticket.issueType),
    acceptanceCriteria: normalizeAcceptanceCriteria(ticket.acceptanceCriteria || []),
  };

  if (!normalizedTicket.description || normalizedTicket.description.length < 40) {
    warnings.push("描述偏短，建议补充业务或技术上下文。");
  }
  if (normalizedTicket.acceptanceCriteria.length < 2) {
    warnings.push("验收标准偏少，建议补充至少 2 条可验证项。");
  }
  if ((normalizedTicket.summary.match(/\s/g) || []).length < 1) {
    warnings.push("标题可能过短，建议加入动作和对象。");
  }
  if ((normalizedTicket.openQuestions || []).length === 0) {
    warnings.push("低信息输入场景下建议保留待确认项。");
  }

  return {
    warnings,
    normalizedTicket,
  };
}
