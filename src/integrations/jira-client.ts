import { config } from "../config.js";
import { IssueType, TicketFieldSet } from "../types/ticket.js";
import {
  JiraMetadataField,
  JiraMetadataPriority,
  JiraMetadataProject,
  JiraMetadataSnapshot,
} from "./jira-metadata.js";
import { saveJiraCreateRecord } from "./jira-record-store.js";
import { JiraRouteDecision, resolveJiraRoute } from "./jira-routing.js";

interface JiraProjectIssueType {
  id: string;
  name: string;
}

interface JiraComponent {
  id: string;
  name: string;
}

interface JiraProjectResponse {
  id: string;
  key: string;
  issueTypes?: JiraProjectIssueType[];
}

interface JiraPriority {
  id: string;
  name: string;
}

interface JiraPrioritySearchResponse {
  values?: JiraPriority[];
}

interface JiraFieldSearchResponse {
  values?: JiraMetadataField[];
  isLast?: boolean;
  startAt?: number;
  maxResults?: number;
  total?: number;
}

interface JiraAssignableUser {
  accountId: string;
  displayName: string;
  active?: boolean;
}

interface JiraCreateIssueResponse {
  id: string;
  key: string;
  self: string;
}

export interface JiraIssuePlan {
  projectKey: string;
  resolvedIssueType: string;
  resolvedPriorityName?: string;
  resolvedComponents: Array<{ name: string }>;
  assigneeAccountId?: string;
  assigneeDisplayName?: string;
  epicKey?: string;
  customFields: Record<string, unknown>;
  routeDecision: JiraRouteDecision;
  payload: {
    fields: Record<string, unknown>;
  };
}

type AdfNode = Record<string, unknown>;

function textNode(text: string): AdfNode {
  return {
    type: "text",
    text,
  };
}

function paragraph(text: string): AdfNode {
  return {
    type: "paragraph",
    content: [textNode(text)],
  };
}

function heading(text: string, level: 2 | 3 = 2): AdfNode {
  return {
    type: "heading",
    attrs: { level },
    content: [textNode(text)],
  };
}

function bulletList(items: string[]): AdfNode {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraph(item)],
    })),
  };
}

function pushTextSection(content: AdfNode[], title: string, body?: string): void {
  if (!body?.trim()) {
    return;
  }

  content.push(heading(title));
  body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => content.push(paragraph(line)));
}

function pushListSection(content: AdfNode[], title: string, items?: string[]): void {
  if (!items || items.length === 0) {
    return;
  }

  content.push(heading(title));
  content.push(bulletList(items));
}

function buildJiraDescription(ticket: TicketFieldSet): AdfNode {
  const content: AdfNode[] = [
    paragraph(`Issue Type: ${ticket.issueType}`),
  ];

  pushTextSection(content, "Background / Context", ticket.background);
  pushTextSection(content, "Problem Statement", ticket.problemStatement);
  pushTextSection(content, "Goal / Objective", ticket.goal);
  pushListSection(content, "Scope", ticket.scope);
  pushListSection(content, "Out of Scope", ticket.outOfScope);
  pushTextSection(content, "Description", ticket.description);
  pushTextSection(content, "Impact", ticket.impact);
  pushListSection(content, "Reproduction", ticket.reproductionSteps);
  pushTextSection(content, "Expected Result", ticket.expectedResult);
  pushTextSection(content, "Actual Result", ticket.actualResult);
  pushListSection(content, "Fix Direction", ticket.fixDirection);
  pushTextSection(content, "Investigation Goal", ticket.investigationGoal);
  pushListSection(content, "Questions to Answer", ticket.questionsToAnswer);
  pushListSection(content, "Deliverables", ticket.deliverables);
  pushListSection(content, "Acceptance Criteria", ticket.acceptanceCriteria);
  pushListSection(content, "Technical Notes", ticket.technicalNotes);
  pushListSection(content, "Dependencies", ticket.dependencies);
  pushListSection(content, "Risks", ticket.risks);
  pushListSection(content, "Assumptions", ticket.assumptions);
  pushListSection(content, "Open Questions", ticket.openQuestions);
  pushListSection(content, "Suggested Follow-up Questions", ticket.suggestedFollowUpQuestions);
  pushListSection(content, "Known Information", ticket.knownInformation);
  pushListSection(content, "Inferred Information", ticket.inferredInformation);

  return {
    version: 1,
    type: "doc",
    content,
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function issueTypeCandidates(type: IssueType): string[] {
  switch (type) {
    case "Bug":
      return ["Bug", "Defect", "Incident", "Task"];
    case "Story":
      return ["Story", "Task"];
    case "Task":
      return ["Task", "Story"];
    case "Spike":
      return ["Spike", "Task", "Story"];
    case "Improvement":
      return ["Improvement", "Task", "Story"];
    case "Epic":
      return ["Epic", "Initiative", "Task"];
    default:
      return ["Task"];
  }
}

export class JiraClient {
  private readonly baseUrl: string;
  private readonly email: string;
  private readonly apiToken: string;

  constructor() {
    if (!config.jiraBaseUrl || !config.jiraEmail || !config.jiraApiToken) {
      throw new Error(
        "缺少 JIRA 配置。请设置 JIRA_BASE_URL、JIRA_EMAIL、JIRA_API_TOKEN。",
      );
    }

    this.baseUrl = normalizeBaseUrl(config.jiraBaseUrl);
    this.email = config.jiraEmail;
    this.apiToken = config.jiraApiToken;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.email}:${this.apiToken}`).toString("base64")}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`JIRA API 请求失败 (${response.status}): ${errorText}`);
    }

    return (await response.json()) as T;
  }

  private async getProject(projectKey: string): Promise<JiraProjectResponse> {
    return this.request<JiraProjectResponse>(`/rest/api/3/project/${encodeURIComponent(projectKey)}`);
  }

  private async getProjectComponents(projectKey: string): Promise<JiraComponent[]> {
    return this.request<JiraComponent[]>(`/rest/api/3/project/${encodeURIComponent(projectKey)}/components`);
  }

  private async getPriorities(): Promise<JiraPriority[]> {
    const response = await this.request<JiraPrioritySearchResponse | JiraPriority[]>("/rest/api/3/priority/search?maxResults=100");
    return Array.isArray(response) ? response : response.values || [];
  }

  private async getFields(): Promise<JiraMetadataField[]> {
    const fields: JiraMetadataField[] = [];
    let startAt = 0;
    const maxResults = 100;

    while (true) {
      const response = await this.request<JiraFieldSearchResponse>(
        `/rest/api/3/field/search?maxResults=${maxResults}&startAt=${startAt}`,
      );
      fields.push(...(response.values || []));

      if (response.isLast || !response.values || response.values.length < maxResults) {
        break;
      }

      startAt += maxResults;
    }

    return fields;
  }

  private async getAssignableUsers(projectKey: string): Promise<JiraAssignableUser[]> {
    try {
      return await this.request<JiraAssignableUser[]>(
        `/rest/api/3/user/assignable/search?project=${encodeURIComponent(projectKey)}&maxResults=100`,
      );
    } catch {
      return [];
    }
  }

  private inferEpicLinkFieldId(fields: JiraMetadataField[]): string | undefined {
    return (
      fields.find((field) => field.name.toLowerCase() === "epic link")?.id ||
      fields.find((field) => field.name.toLowerCase().includes("epic link"))?.id
    );
  }

  private async resolveIssueTypeName(projectKey: string, issueType: IssueType): Promise<string> {
    const project = await this.getProject(projectKey);
    const available = (project.issueTypes || []).map((item) => item.name);
    const candidates = issueTypeCandidates(issueType);

    const matched = candidates.find((candidate) =>
      available.some((availableName) => availableName.toLowerCase() === candidate.toLowerCase()),
    );

    return matched || available[0] || "Task";
  }

  private async resolveComponents(projectKey: string, suggestions?: string[]): Promise<Array<{ name: string }>> {
    if (!suggestions || suggestions.length === 0) {
      return [];
    }

    const components = await this.getProjectComponents(projectKey);
    const matched = suggestions
      .map((suggestion) =>
        components.find((component) => component.name.toLowerCase() === suggestion.toLowerCase()),
      )
      .filter((item): item is JiraComponent => Boolean(item));

    return matched.map((component) => ({ name: component.name }));
  }

  private async resolvePriorityName(priorityName?: string): Promise<string | undefined> {
    if (!priorityName) {
      return undefined;
    }

    const priorities = await this.getPriorities();
    const candidates = {
      high: ["High", "Highest", "Blocker", "Critical"],
      medium: ["Medium", "Normal"],
      low: ["Low", "Lowest", "Minor"],
    }[priorityName.toLowerCase()] || [priorityName];

    for (const candidate of candidates) {
      const matched = priorities.find((item) => item.name.toLowerCase() === candidate.toLowerCase());
      if (matched) {
        return matched.name;
      }
    }

    const fuzzy = priorities.find((item) => item.name.toLowerCase().includes(priorityName.toLowerCase()));
    return fuzzy?.name;
  }

  async planIssue(ticket: TicketFieldSet, rawInput: string, projectKeyInput?: string): Promise<JiraIssuePlan> {
    const routeDecision = resolveJiraRoute(ticket, rawInput);
    const projectKey = projectKeyInput || routeDecision.projectKey || config.jiraProjectKey;
    if (!projectKey) {
      throw new Error("缺少项目 Key。请设置 JIRA_PROJECT_KEY、路由规则 projectKey，或在命令里传入 --project。");
    }

    const mergedLabels = unique([...(ticket.labelsSuggestion || []), ...(routeDecision.labels || [])]);
    const mergedComponents = unique([...(ticket.componentsSuggestion || []), ...(routeDecision.components || [])]);
    const customFields = {
      ...(ticket.customFieldSuggestions || {}),
      ...(routeDecision.customFields || {}),
    };

    const [resolvedIssueType, resolvedComponents, resolvedPriorityName] = await Promise.all([
      this.resolveIssueTypeName(projectKey, ticket.issueType),
      this.resolveComponents(projectKey, mergedComponents),
      this.resolvePriorityName(routeDecision.priorityName || ticket.prioritySuggestion),
    ]);

    const fields: Record<string, unknown> = {
      project: { key: projectKey },
      summary: ticket.summary,
      issuetype: { name: resolvedIssueType },
      description: buildJiraDescription({
        ...ticket,
        labelsSuggestion: mergedLabels,
        componentsSuggestion: mergedComponents,
        assigneeAccountIdSuggestion: routeDecision.assigneeAccountId,
        assigneeDisplayNameSuggestion: routeDecision.assigneeDisplayName,
        epicSuggestion: routeDecision.epicKey,
        customFieldSuggestions: customFields,
        routingSuggestionNotes: routeDecision.notes,
      }),
      labels: mergedLabels,
      ...(resolvedComponents.length > 0 ? { components: resolvedComponents } : {}),
      ...(resolvedPriorityName ? { priority: { name: resolvedPriorityName } } : {}),
      ...(routeDecision.assigneeAccountId ? { assignee: { accountId: routeDecision.assigneeAccountId } } : {}),
    };

    if (routeDecision.epicKey && config.jiraEpicLinkFieldId) {
      fields[config.jiraEpicLinkFieldId] = routeDecision.epicKey;
    }

    Object.assign(fields, customFields);

    return {
      projectKey,
      resolvedIssueType,
      resolvedPriorityName,
      resolvedComponents,
      assigneeAccountId: routeDecision.assigneeAccountId,
      assigneeDisplayName: routeDecision.assigneeDisplayName,
      epicKey: routeDecision.epicKey,
      customFields,
      routeDecision,
      payload: { fields },
    };
  }

  async syncMetadata(projectKeysInput?: string[]): Promise<JiraMetadataSnapshot> {
    const projectKeys = (projectKeysInput && projectKeysInput.length > 0
      ? projectKeysInput
      : [config.jiraProjectKey].filter(Boolean)) as string[];

    if (projectKeys.length === 0) {
      throw new Error("缺少项目 Key。请传入项目列表或设置 JIRA_PROJECT_KEY。");
    }

    const [fields, priorities, projectData] = await Promise.all([
      this.getFields(),
      this.getPriorities(),
      Promise.all(
        projectKeys.map(async (projectKey) => {
          const [project, components, assignableUsers] = await Promise.all([
            this.getProject(projectKey),
            this.getProjectComponents(projectKey),
            this.getAssignableUsers(projectKey),
          ]);

          const metadataProject: JiraMetadataProject = {
            id: project.id,
            key: project.key,
            name: "name" in project && typeof (project as { name?: unknown }).name === "string"
              ? ((project as { name?: string }).name || project.key)
              : project.key,
            issueTypes: (project.issueTypes || []).map((item) => item.name),
            components: components.map((item) => item.name),
            assignableUsers: assignableUsers.map((user) => ({
              accountId: user.accountId,
              displayName: user.displayName,
              active: user.active,
            })),
          };

          return metadataProject;
        }),
      ),
    ]);

    return {
      fetchedAt: new Date().toISOString(),
      baseUrl: this.baseUrl,
      projects: projectData,
      priorities: priorities.map((item): JiraMetadataPriority => ({
        id: item.id,
        name: item.name,
      })),
      fields,
      suggestedEpicLinkFieldId: this.inferEpicLinkFieldId(fields),
    };
  }

  async createIssue(ticket: TicketFieldSet, rawInput: string, projectKeyInput?: string): Promise<{
    id: string;
    key: string;
    self: string;
    browseUrl: string;
    projectKey: string;
    resolvedIssueType: string;
    resolvedPriorityName?: string;
    assigneeAccountId?: string;
    assigneeDisplayName?: string;
    epicKey?: string;
    recordPath: string;
    routeDecision: JiraRouteDecision;
  }> {
    const plan = await this.planIssue(ticket, rawInput, projectKeyInput);

    const created = await this.request<JiraCreateIssueResponse>("/rest/api/3/issue", {
      method: "POST",
      body: JSON.stringify(plan.payload),
    });

    const recordPath = saveJiraCreateRecord({
      createdAt: new Date().toISOString(),
      sourceInput: rawInput,
      issueKey: created.key,
      browseUrl: `${this.baseUrl}/browse/${created.key}`,
      projectKey: plan.projectKey,
      issueType: plan.resolvedIssueType,
      summary: ticket.summary,
      assigneeAccountId: plan.assigneeAccountId,
      epicKey: plan.epicKey,
      priorityName: plan.resolvedPriorityName,
      routeDecision: plan.routeDecision,
      customFields: plan.customFields,
      ticket: {
        ...ticket,
        assigneeAccountIdSuggestion: plan.assigneeAccountId,
        assigneeDisplayNameSuggestion: plan.assigneeDisplayName,
        epicSuggestion: plan.epicKey,
        customFieldSuggestions: plan.customFields,
        routingSuggestionNotes: plan.routeDecision.notes,
      },
    });

    return {
      ...created,
      browseUrl: `${this.baseUrl}/browse/${created.key}`,
      projectKey: plan.projectKey,
      resolvedIssueType: plan.resolvedIssueType,
      resolvedPriorityName: plan.resolvedPriorityName,
      assigneeAccountId: plan.assigneeAccountId,
      assigneeDisplayName: plan.assigneeDisplayName,
      epicKey: plan.epicKey,
      recordPath,
      routeDecision: plan.routeDecision,
    };
  }
}
