import { Command } from "commander";
import { config } from "./config.js";
import { generateTicket } from "./core/ticket-service.js";
import { OutputMode, RenderFormat } from "./types/ticket.js";
import { FEW_SHOT_EXAMPLES } from "./templates/few-shot.js";
import { JiraClient } from "./integrations/jira-client.js";
import { JiraIssuePlan } from "./integrations/jira-client.js";
import {
  buildRoutingConfigFromMetadata,
  saveJiraMetadata,
  saveRoutingConfig,
} from "./integrations/jira-metadata.js";
import { resolveJiraRoute } from "./integrations/jira-routing.js";

const program = new Command();

function printWarnings(warnings: string[], format: RenderFormat): void {
  if (warnings.length === 0 || format === "json") {
    return;
  }

  process.stdout.write("\n## Warnings\n");
  for (const warning of warnings) {
    process.stdout.write(`- ${warning}\n`);
  }
}

function printJiraPlan(plan: JiraIssuePlan): void {
  process.stdout.write("\n## Jira Creation Plan\n");
  process.stdout.write(`- Project: ${plan.projectKey}\n`);
  process.stdout.write(`- Issue Type: ${plan.resolvedIssueType}\n`);
  if (plan.resolvedPriorityName) {
    process.stdout.write(`- Priority: ${plan.resolvedPriorityName}\n`);
  }
  if (plan.assigneeDisplayName || plan.assigneeAccountId) {
    process.stdout.write(`- Assignee: ${plan.assigneeDisplayName || plan.assigneeAccountId}\n`);
  }
  if (plan.epicKey) {
    process.stdout.write(`- Epic: ${plan.epicKey}\n`);
  }
  if (plan.resolvedComponents.length > 0) {
    process.stdout.write(`- Components: ${plan.resolvedComponents.map((item) => item.name).join(", ")}\n`);
  }
  if (Object.keys(plan.customFields).length > 0) {
    process.stdout.write(`- Custom Fields: ${JSON.stringify(plan.customFields)}\n`);
  }
  if (plan.routeDecision.matchedRuleNames.length > 0) {
    process.stdout.write(`- Matched Routing Rules: ${plan.routeDecision.matchedRuleNames.join(", ")}\n`);
  }
}

program
  .name("ai-agent-jira")
  .description("Generate enterprise-ready JIRA ticket drafts from short inputs")
  .version("0.1.0");

program
  .command("generate")
  .description("Generate a JIRA ticket draft")
  .requiredOption("-i, --input <text>", "Short input such as 'grafana 登录403'")
  .option("-m, --mode <mode>", "minimal | standard | detailed | jira_markup | json", config.defaultOutputMode)
  .option("-f, --format <format>", "markdown | jira | json", config.defaultFormat)
  .option("--no-llm", "Disable LLM and use rule-based generation only")
  .action(async (options) => {
    try {
      const mode = options.mode as OutputMode;
      const format = options.format as RenderFormat;

      const { rendered, result } = await generateTicket({
        input: options.input,
        mode,
        format,
        useLlm: options.llm,
      });

      process.stdout.write(`${rendered}\n`);
      printWarnings(result.meta.warnings, format);
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  });

program
  .command("examples")
  .description("Show built-in few-shot examples")
  .action(() => {
    process.stdout.write(`${JSON.stringify(FEW_SHOT_EXAMPLES, null, 2)}\n`);
  });

program
  .command("sync-metadata")
  .description("Fetch Jira metadata and save local cache")
  .option(
    "-p, --projects <keys>",
    "Comma-separated Jira project keys, fallback to JIRA_PROJECT_KEY",
  )
  .action(async (options) => {
    try {
      const jiraClient = new JiraClient();
      const projectKeys = typeof options.projects === "string"
        ? options.projects.split(",").map((item: string) => item.trim()).filter(Boolean)
        : undefined;

      const snapshot = await jiraClient.syncMetadata(projectKeys);
      const saved = saveJiraMetadata(snapshot);

      process.stdout.write(`Metadata saved: ${saved.latestPath}\n`);
      process.stdout.write(`Snapshot saved: ${saved.snapshotPath}\n`);
      process.stdout.write(`Projects: ${snapshot.projects.map((item) => item.key).join(", ")}\n`);
      if (snapshot.suggestedEpicLinkFieldId) {
        process.stdout.write(`Suggested Epic Link Field: ${snapshot.suggestedEpicLinkFieldId}\n`);
      }
      process.stdout.write(`Fields: ${snapshot.fields.length}\n`);
      process.stdout.write(`Priorities: ${snapshot.priorities.map((item) => item.name).join(", ")}\n`);
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  });

program
  .command("bootstrap-routing")
  .description("Generate config/jira-routing.json from live Jira metadata")
  .option(
    "-p, --projects <keys>",
    "Comma-separated Jira project keys, fallback to JIRA_PROJECT_KEY",
  )
  .option("--print", "Print generated routing JSON to stdout")
  .action(async (options) => {
    try {
      const jiraClient = new JiraClient();
      const projectKeys = typeof options.projects === "string"
        ? options.projects.split(",").map((item: string) => item.trim()).filter(Boolean)
        : undefined;

      const snapshot = await jiraClient.syncMetadata(projectKeys);
      const savedMetadata = saveJiraMetadata(snapshot);
      const routingConfig = buildRoutingConfigFromMetadata(snapshot);
      const routingPath = saveRoutingConfig(routingConfig);

      process.stdout.write(`Routing config saved: ${routingPath}\n`);
      process.stdout.write(`Metadata cache updated: ${savedMetadata.latestPath}\n`);
      if (snapshot.suggestedEpicLinkFieldId) {
        process.stdout.write(`Suggested Epic Link Field: ${snapshot.suggestedEpicLinkFieldId}\n`);
      }
      if (options.print) {
        process.stdout.write(`\n${JSON.stringify(routingConfig, null, 2)}\n`);
      }
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  });

program
  .command("create")
  .description("Generate a ticket and create it directly in Jira")
  .requiredOption("-i, --input <text>", "Short input such as 'grafana 登录403'")
  .option("-m, --mode <mode>", "minimal | standard | detailed | jira_markup | json", "standard")
  .option("-p, --project <key>", "Jira project key, fallback to JIRA_PROJECT_KEY")
  .option("--no-llm", "Disable LLM and use rule-based generation only")
  .option("--dry-run", "Only generate and preview the issue without creating it")
  .action(async (options) => {
    try {
      const mode = options.mode as OutputMode;
      const { rendered, result } = await generateTicket({
        input: options.input,
        mode,
        format: "jira",
        useLlm: options.llm,
      });

      if (options.dryRun) {
        process.stdout.write(`${rendered}\n`);
        try {
          const jiraClient = new JiraClient();
          const plan = await jiraClient.planIssue(result.ticket, options.input, options.project);
          printJiraPlan(plan);
        } catch (error) {
          const routeDecision = resolveJiraRoute(result.ticket, options.input);
          process.stdout.write("\n## Jira Creation Plan\n");
          process.stdout.write(`- Project: ${options.project || routeDecision.projectKey || config.jiraProjectKey || "未配置"}\n`);
          process.stdout.write(`- Issue Type: ${result.ticket.issueType}\n`);
          process.stdout.write(`- Priority: ${routeDecision.priorityName || result.ticket.prioritySuggestion || "未配置"}\n`);
          if (routeDecision.assigneeDisplayName || routeDecision.assigneeAccountId) {
            process.stdout.write(`- Assignee: ${routeDecision.assigneeDisplayName || routeDecision.assigneeAccountId}\n`);
          }
          if (routeDecision.epicKey) {
            process.stdout.write(`- Epic: ${routeDecision.epicKey}\n`);
          }
          if ((routeDecision.components || []).length > 0) {
            process.stdout.write(`- Components: ${(routeDecision.components || []).join(", ")}\n`);
          }
          if (Object.keys(routeDecision.customFields || {}).length > 0) {
            process.stdout.write(`- Custom Fields: ${JSON.stringify(routeDecision.customFields)}\n`);
          }
          if (routeDecision.matchedRuleNames.length > 0) {
            process.stdout.write(`- Matched Routing Rules: ${routeDecision.matchedRuleNames.join(", ")}\n`);
          }
          process.stdout.write(`- Note: ${error instanceof Error ? error.message : String(error)}\n`);
        }
        printWarnings(result.meta.warnings, "jira");
        return;
      }

      const jiraClient = new JiraClient();
      const created = await jiraClient.createIssue(result.ticket, options.input, options.project);

      process.stdout.write(`Created Jira issue: ${created.key}\n`);
      process.stdout.write(`Browse URL: ${created.browseUrl}\n`);
      process.stdout.write(`Project: ${created.projectKey}\n`);
      process.stdout.write(`Issue Type: ${created.resolvedIssueType}\n`);
      if (created.resolvedPriorityName) {
        process.stdout.write(`Priority: ${created.resolvedPriorityName}\n`);
      }
      if (created.assigneeDisplayName || created.assigneeAccountId) {
        process.stdout.write(`Assignee: ${created.assigneeDisplayName || created.assigneeAccountId}\n`);
      }
      if (created.epicKey) {
        process.stdout.write(`Epic: ${created.epicKey}\n`);
      }
      process.stdout.write(`Local Record: ${created.recordPath}\n`);
      if (created.routeDecision.matchedRuleNames.length > 0) {
        process.stdout.write(`Routing Rules: ${created.routeDecision.matchedRuleNames.join(", ")}\n`);
      }
      printWarnings(result.meta.warnings, "jira");
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
