import { LlmGenerateRequest, LlmGenerateResponse } from "../types/ticket.js";

export interface LlmClient {
  generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse>;
}
