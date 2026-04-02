import { LlmClient } from "./base.js";
import { LlmGenerateRequest, LlmGenerateResponse } from "../types/ticket.js";

export class MockLlmClient implements LlmClient {
  async generate(_request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    return {
      text: "",
      model: "mock",
    };
  }
}
