import { TicketFieldSet } from "../types/ticket.js";

export interface ParsedLlmResult {
  ticket?: Partial<TicketFieldSet>;
  warnings: string[];
}

export function parseLlmJson(raw: string): ParsedLlmResult {
  if (!raw.trim()) {
    return { warnings: ["LLM 未返回内容，已使用规则草稿兜底。"] };
  }

  try {
    const parsed = JSON.parse(raw) as { ticket?: Partial<TicketFieldSet>; warnings?: string[] };
    return {
      ticket: parsed.ticket,
      warnings: parsed.warnings || [],
    };
  } catch {
    return {
      warnings: ["LLM 输出不是合法 JSON，已使用规则草稿兜底。"],
    };
  }
}

export function mergeTicket(base: TicketFieldSet, enriched?: Partial<TicketFieldSet>): TicketFieldSet {
  if (!enriched) {
    return base;
  }

  return {
    ...base,
    ...enriched,
    acceptanceCriteria:
      enriched.acceptanceCriteria && enriched.acceptanceCriteria.length > 0
        ? enriched.acceptanceCriteria
        : base.acceptanceCriteria,
    scope: enriched.scope && enriched.scope.length > 0 ? enriched.scope : base.scope,
    outOfScope: enriched.outOfScope && enriched.outOfScope.length > 0 ? enriched.outOfScope : base.outOfScope,
    technicalNotes:
      enriched.technicalNotes && enriched.technicalNotes.length > 0
        ? enriched.technicalNotes
        : base.technicalNotes,
    dependencies:
      enriched.dependencies && enriched.dependencies.length > 0 ? enriched.dependencies : base.dependencies,
    risks: enriched.risks && enriched.risks.length > 0 ? enriched.risks : base.risks,
    assumptions:
      enriched.assumptions && enriched.assumptions.length > 0 ? enriched.assumptions : base.assumptions,
    openQuestions:
      enriched.openQuestions && enriched.openQuestions.length > 0
        ? enriched.openQuestions
        : base.openQuestions,
    suggestedFollowUpQuestions:
      enriched.suggestedFollowUpQuestions && enriched.suggestedFollowUpQuestions.length > 0
        ? enriched.suggestedFollowUpQuestions
        : base.suggestedFollowUpQuestions,
    labelsSuggestion:
      enriched.labelsSuggestion && enriched.labelsSuggestion.length > 0
        ? enriched.labelsSuggestion
        : base.labelsSuggestion,
    componentsSuggestion:
      enriched.componentsSuggestion && enriched.componentsSuggestion.length > 0
        ? enriched.componentsSuggestion
        : base.componentsSuggestion,
  };
}
