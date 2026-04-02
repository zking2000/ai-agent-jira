import OpenAI from "openai";
import { config } from "../config.js";
import { LlmClient } from "./base.js";
import { LlmGenerateRequest, LlmGenerateResponse } from "../types/ticket.js";

export class OpenAiClient implements LlmClient {
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.llmApiKey || "local-proxy",
      baseURL: config.llmBaseUrl,
    });
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    const response = await this.client.chat.completions.create({
      model: config.llmModel,
      temperature: request.temperature ?? 0.2,
      messages: [
        {
          role: "system",
          content: request.systemPrompt,
        },
        {
          role: "user",
          content: request.prompt,
        },
      ],
    });

    return {
      text: response.choices[0]?.message?.content || "",
      model: config.llmModel,
    };
  }
}
