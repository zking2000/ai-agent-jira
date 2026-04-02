export type IssueType =
  | "Bug"
  | "Story"
  | "Task"
  | "Spike"
  | "Improvement"
  | "Epic";

export type OutputMode =
  | "minimal"
  | "standard"
  | "detailed"
  | "jira_markup"
  | "json";

export type RenderFormat = "markdown" | "jira" | "json";

export interface InputSignals {
  normalizedInput: string;
  tokens: string[];
  language: "zh" | "en" | "mixed";
  systems: string[];
  probableActions: string[];
  severityHints: string[];
  missingInfo: string[];
}

export interface ClassificationResult {
  issueType: IssueType;
  confidence: number;
  reasons: string[];
  candidateTypes: Array<{
    type: IssueType;
    score: number;
  }>;
}

export interface TicketFieldSet {
  summary: string;
  issueType: IssueType;
  background?: string;
  problemStatement?: string;
  goal?: string;
  scope?: string[];
  outOfScope?: string[];
  description?: string;
  impact?: string;
  reproductionSteps?: string[];
  expectedResult?: string;
  actualResult?: string;
  fixDirection?: string[];
  investigationGoal?: string;
  questionsToAnswer?: string[];
  deliverables?: string[];
  acceptanceCriteria: string[];
  technicalNotes?: string[];
  dependencies?: string[];
  risks?: string[];
  assumptions?: string[];
  openQuestions?: string[];
  suggestedFollowUpQuestions?: string[];
  labelsSuggestion?: string[];
  componentsSuggestion?: string[];
  prioritySuggestion?: string;
  assigneeAccountIdSuggestion?: string;
  assigneeDisplayNameSuggestion?: string;
  epicSuggestion?: string;
  customFieldSuggestions?: Record<string, unknown>;
  routingSuggestionNotes?: string[];
  knownInformation?: string[];
  inferredInformation?: string[];
}

export interface PromptContext {
  rawInput: string;
  mode: OutputMode;
  signals: InputSignals;
  classification: ClassificationResult;
  draft: TicketFieldSet;
}

export interface GeneratedTicket {
  ticket: TicketFieldSet;
  meta: {
    outputMode: OutputMode;
    formatter: RenderFormat;
    sourceInput: string;
    usedLlm: boolean;
    warnings: string[];
  };
}

export interface LlmGenerateRequest {
  prompt: string;
  systemPrompt: string;
  temperature?: number;
}

export interface LlmGenerateResponse {
  text: string;
  model?: string;
}

export interface FewShotExample {
  rawInput: string;
  classifiedIssueType: IssueType;
  whyClassification: string;
  inferredContent: string[];
  structuredTicket: Partial<TicketFieldSet>;
}
