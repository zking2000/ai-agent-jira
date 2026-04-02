import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

export interface JiraMetadataField {
  id: string;
  name: string;
  custom?: boolean;
  schema?: Record<string, unknown>;
}

export interface JiraMetadataPriority {
  id: string;
  name: string;
}

export interface JiraMetadataUser {
  accountId: string;
  displayName: string;
  active?: boolean;
}

export interface JiraMetadataProject {
  id: string;
  key: string;
  name: string;
  issueTypes: string[];
  components: string[];
  assignableUsers: JiraMetadataUser[];
}

export interface JiraMetadataSnapshot {
  fetchedAt: string;
  baseUrl: string;
  projects: JiraMetadataProject[];
  priorities: JiraMetadataPriority[];
  fields: JiraMetadataField[];
  suggestedEpicLinkFieldId?: string;
}

function resolveMetadataDir(): string {
  return path.isAbsolute(config.jiraMetadataDir)
    ? config.jiraMetadataDir
    : path.resolve(process.cwd(), config.jiraMetadataDir);
}

export function saveJiraMetadata(snapshot: JiraMetadataSnapshot): {
  latestPath: string;
  snapshotPath: string;
} {
  const dir = resolveMetadataDir();
  fs.mkdirSync(dir, { recursive: true });

  const latestPath = path.join(dir, "latest.json");
  const snapshotPath = path.join(
    dir,
    `${snapshot.fetchedAt.replace(/[:.]/g, "-")}.json`,
  );

  fs.writeFileSync(latestPath, JSON.stringify(snapshot, null, 2), "utf8");
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");

  return {
    latestPath,
    snapshotPath,
  };
}

export function buildRoutingConfigFromMetadata(snapshot: JiraMetadataSnapshot): Record<string, unknown> {
  const defaultsProject = snapshot.projects[0];
  const defaultPriority =
    snapshot.priorities.find((item) => item.name.toLowerCase() === "medium")?.name ||
    snapshot.priorities.find((item) => item.name.toLowerCase() === "normal")?.name ||
    snapshot.priorities[0]?.name;

  const rules = snapshot.projects.map((project) => {
    const systems = project.components
      .map((component) => component.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 12);

    const candidateAssignee =
      project.assignableUsers.length === 1 ? project.assignableUsers[0] : undefined;

    return {
      name: `${project.key.toLowerCase()}-project-route`,
      match: {
        systems,
      },
      apply: {
        projectKey: project.key,
        ...(candidateAssignee
          ? {
              assigneeAccountId: candidateAssignee.accountId,
              assigneeDisplayName: candidateAssignee.displayName,
            }
          : {}),
        labels: [project.key.toLowerCase()],
      },
    };
  });

  return {
    defaults: {
      projectKey: defaultsProject?.key || config.jiraProjectKey || "PLAT",
      assigneeAccountId: config.jiraDefaultAssigneeAccountId,
      priorityName: defaultPriority || "Medium",
      labels: ["ai-generated", "auto-created"],
    },
    metadataHints: {
      generatedAt: snapshot.fetchedAt,
      sourceProjects: snapshot.projects.map((project) => ({
        key: project.key,
        name: project.name,
        issueTypes: project.issueTypes,
        components: project.components,
        assignableUsers: project.assignableUsers.map((user) => ({
          accountId: user.accountId,
          displayName: user.displayName,
        })),
      })),
      suggestedEpicLinkFieldId: snapshot.suggestedEpicLinkFieldId,
    },
    rules,
  };
}

export function saveRoutingConfig(configObject: Record<string, unknown>, targetPath = config.jiraRoutingConfigPath): string {
  const resolvedPath = path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(process.cwd(), targetPath);

  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, `${JSON.stringify(configObject, null, 2)}\n`, "utf8");

  return resolvedPath;
}
