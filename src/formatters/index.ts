import { GeneratedTicket, RenderFormat, TicketFieldSet } from "../types/ticket.js";

function section(title: string, body?: string | string[]): string {
  if (!body || (Array.isArray(body) && body.length === 0)) {
    return "";
  }

  const content = Array.isArray(body) ? body.map((item) => `- ${item}`).join("\n") : body;
  return `## ${title}\n${content}\n`;
}

function formatMarkdown(ticket: TicketFieldSet): string {
  return [
    `# ${ticket.summary}`,
    "",
    `- Issue Type: ${ticket.issueType}`,
    `- Priority Suggestion: ${ticket.prioritySuggestion || "Medium"}`,
    `- Labels Suggestion: ${(ticket.labelsSuggestion || []).join(", ")}`,
    `- Components Suggestion: ${(ticket.componentsSuggestion || []).join(", ")}`,
    "",
    section("Background / Context", ticket.background).trimEnd(),
    section("Problem Statement", ticket.problemStatement).trimEnd(),
    section("Goal / Objective", ticket.goal).trimEnd(),
    section("Scope", ticket.scope).trimEnd(),
    section("Out of Scope", ticket.outOfScope).trimEnd(),
    section("Description", ticket.description).trimEnd(),
    section("Impact", ticket.impact).trimEnd(),
    section("Reproduction", ticket.reproductionSteps).trimEnd(),
    section("Expected Result", ticket.expectedResult).trimEnd(),
    section("Actual Result", ticket.actualResult).trimEnd(),
    section("Fix Direction", ticket.fixDirection).trimEnd(),
    section("Investigation Goal", ticket.investigationGoal).trimEnd(),
    section("Questions to Answer", ticket.questionsToAnswer).trimEnd(),
    section("Deliverables", ticket.deliverables).trimEnd(),
    section("Acceptance Criteria", ticket.acceptanceCriteria).trimEnd(),
    section("Technical Notes", ticket.technicalNotes).trimEnd(),
    section("Dependencies", ticket.dependencies).trimEnd(),
    section("Risks", ticket.risks).trimEnd(),
    section("Assignee Suggestion", ticket.assigneeDisplayNameSuggestion || ticket.assigneeAccountIdSuggestion).trimEnd(),
    section("Epic Suggestion", ticket.epicSuggestion).trimEnd(),
    section("Assumptions", ticket.assumptions).trimEnd(),
    section("Open Questions", ticket.openQuestions).trimEnd(),
    section(
      "Custom Field Suggestions",
      ticket.customFieldSuggestions ? JSON.stringify(ticket.customFieldSuggestions, null, 2) : undefined,
    ).trimEnd(),
    section("Routing Notes", ticket.routingSuggestionNotes).trimEnd(),
    section("Suggested Follow-up Questions", ticket.suggestedFollowUpQuestions).trimEnd(),
    section("Known Information", ticket.knownInformation).trimEnd(),
    section("Inferred Information", ticket.inferredInformation).trimEnd(),
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function formatJiraMarkup(ticket: TicketFieldSet): string {
  const list = (items?: string[]) => (items && items.length > 0 ? items.map((i) => `* ${i}`).join("\n") : "");
  const text = (title: string, body?: string | string[]) => {
    if (!body || (Array.isArray(body) && body.length === 0)) {
      return "";
    }
    return `h2. ${title}\n${Array.isArray(body) ? list(body) : body}`;
  };

  return [
    `h1. ${ticket.summary}`,
    `*Issue Type:* ${ticket.issueType}`,
    `*Priority Suggestion:* ${ticket.prioritySuggestion || "Medium"}`,
    text("Background / Context", ticket.background),
    text("Problem Statement", ticket.problemStatement),
    text("Goal / Objective", ticket.goal),
    text("Scope", ticket.scope),
    text("Out of Scope", ticket.outOfScope),
    text("Description", ticket.description),
    text("Acceptance Criteria", ticket.acceptanceCriteria),
    text("Technical Notes", ticket.technicalNotes),
    text("Dependencies", ticket.dependencies),
    text("Risks", ticket.risks),
    text("Assignee Suggestion", ticket.assigneeDisplayNameSuggestion || ticket.assigneeAccountIdSuggestion),
    text("Epic Suggestion", ticket.epicSuggestion),
    text("Assumptions", ticket.assumptions),
    text("Open Questions", ticket.openQuestions),
    text(
      "Custom Field Suggestions",
      ticket.customFieldSuggestions ? JSON.stringify(ticket.customFieldSuggestions, null, 2) : undefined,
    ),
    text("Routing Notes", ticket.routingSuggestionNotes),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function renderTicket(result: GeneratedTicket, format: RenderFormat): string {
  if (format === "json") {
    return JSON.stringify(result, null, 2);
  }
  if (format === "jira") {
    return formatJiraMarkup(result.ticket);
  }
  return formatMarkdown(result.ticket);
}
