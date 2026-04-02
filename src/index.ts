import { Command } from "commander";
import { config } from "./config.js";
import { generateTicket } from "./core/ticket-service.js";
import { OutputMode, RenderFormat } from "./types/ticket.js";
import { FEW_SHOT_EXAMPLES } from "./templates/few-shot.js";

const program = new Command();

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
    const mode = options.mode as OutputMode;
    const format = options.format as RenderFormat;

    const { rendered, result } = await generateTicket({
      input: options.input,
      mode,
      format,
      useLlm: options.llm,
    });

    process.stdout.write(`${rendered}\n`);

    if (result.meta.warnings.length > 0 && format !== "json") {
      process.stdout.write("\n## Warnings\n");
      for (const warning of result.meta.warnings) {
        process.stdout.write(`- ${warning}\n`);
      }
    }
  });

program
  .command("examples")
  .description("Show built-in few-shot examples")
  .action(() => {
    process.stdout.write(`${JSON.stringify(FEW_SHOT_EXAMPLES, null, 2)}\n`);
  });

program.parseAsync(process.argv);
