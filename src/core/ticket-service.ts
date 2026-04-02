import { config } from "../config.js";
import { logger } from "../logger.js";
import { MockLlmClient } from "../llm/mock-client.js";
import { OpenAiClient } from "../llm/openai-client.js";
import { LlmClient } from "../llm/base.js";
import {
  GeneratedTicket,
  OutputMode,
  PromptContext,
  RenderFormat,
} from "../types/ticket.js";
import { parseInput } from "./input-parser.js";
import { classifyIssueType } from "./issue-type-classifier.js";
import { buildDraftTicket } from "./ticket-enricher.js";
import { buildPromptRequest } from "./prompt-builder.js";
import { mergeTicket, parseLlmJson } from "./response-parser.js";
import { qualityCheck } from "./quality-checker.js";
import { renderTicket } from "../formatters/index.js";

export interface GenerateOptions {
  input: string;
  mode: OutputMode;
  format: RenderFormat;
  useLlm?: boolean;
}

function createClient(): LlmClient {
  return config.llmProvider === "openai" ? new OpenAiClient() : new MockLlmClient();
}

function trimByMode(result: GeneratedTicket, mode: OutputMode): GeneratedTicket {
  if (mode !== "minimal") {
    return result;
  }

  const ticket = result.ticket;
  return {
    ...result,
    ticket: {
      summary: ticket.summary,
      issueType: ticket.issueType,
      description: ticket.description,
      acceptanceCriteria: ticket.acceptanceCriteria,
    },
  };
}

export async function generateTicket(options: GenerateOptions): Promise<{
  result: GeneratedTicket;
  rendered: string;
}> {
  const signals = parseInput(options.input);
  const classification = classifyIssueType(signals);
  const draft = buildDraftTicket(options.input, signals, classification);

  let warnings: string[] = [];
  let usedLlm = false;
  let finalTicket = draft;

  if (options.useLlm !== false) {
    try {
      const context: PromptContext = {
        rawInput: options.input,
        mode: options.mode,
        signals,
        classification,
        draft,
      };
      const request = buildPromptRequest(context);
      const client = createClient();
      const response = await client.generate(request);
      const parsed = parseLlmJson(response.text);
      finalTicket = mergeTicket(draft, parsed.ticket);
      warnings = warnings.concat(parsed.warnings);
      usedLlm = Boolean(response.text);
    } catch (error) {
      logger.warn({ err: error }, "LLM enrichment failed, fallback to rule-based draft");
      warnings.push("LLM 增强失败，已回退到规则生成结果。");
    }
  }

  const quality = qualityCheck(finalTicket);
  warnings = warnings.concat(quality.warnings);

  const result = trimByMode(
    {
      ticket: quality.normalizedTicket,
      meta: {
        outputMode: options.mode,
        formatter: options.format,
        sourceInput: options.input,
        usedLlm,
        warnings,
      },
    },
    options.mode,
  );

  return {
    result,
    rendered: renderTicket(result, options.format),
  };
}
