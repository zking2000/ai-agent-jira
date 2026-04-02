import { buildSystemPrompt, buildUserPrompt } from "../templates/system-prompt.js";
import { LlmGenerateRequest, PromptContext } from "../types/ticket.js";

export function buildPromptRequest(context: PromptContext): LlmGenerateRequest {
  return {
    systemPrompt: buildSystemPrompt(context.mode),
    prompt: buildUserPrompt(context),
    temperature: 0.2,
  };
}
