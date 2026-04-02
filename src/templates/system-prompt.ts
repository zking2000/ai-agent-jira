import { OutputMode, PromptContext } from "../types/ticket.js";
import { FEW_SHOT_EXAMPLES } from "./few-shot.js";

function modeInstructions(mode: OutputMode): string {
  switch (mode) {
    case "minimal":
      return "只输出适合快速建票的最小字段：summary、issueType、description、acceptanceCriteria。";
    case "detailed":
      return "输出完整且偏详尽的 ticket，强调 assumptions、risks、dependencies、openQuestions。";
    case "jira_markup":
      return "输出适合直接粘贴到 JIRA 描述栏的结构化正文，使用清晰标题和列表。";
    case "json":
      return "必须输出合法 JSON，不要输出任何解释性前后文。";
    case "standard":
    default:
      return "输出标准结构化 ticket，覆盖常见研发协作所需字段。";
  }
}

export function buildSystemPrompt(mode: OutputMode): string {
  const examples = FEW_SHOT_EXAMPLES.map((example, index) => {
    return [
      `Example ${index + 1}`,
      `raw_input: ${example.rawInput}`,
      `issue_type: ${example.classifiedIssueType}`,
      `why: ${example.whyClassification}`,
      `inferred: ${example.inferredContent.join("; ")}`,
      `ticket_stub: ${JSON.stringify(example.structuredTicket)}`,
    ].join("\n");
  }).join("\n\n");

  return [
    "你是企业内部 JIRA Ticket 生成助手，擅长把极短、粗糙、信息不足的输入扩展成高质量、可执行、可分派、可验收的 ticket。",
    "你的输出必须专业、克制、不要空话，不要虚构用户未提供的具体环境细节。",
    "如果信息不足，先生成高质量 draft，并明确 knownInformation、inferredInformation、assumptions、openQuestions。",
    "你必须优先生成对工程团队有帮助的内容：问题、目标、范围、依赖、风险、验收标准。",
    "验收标准尽量可测试，可使用 Given/When/Then 或 checklist 形式。",
    "对于 Bug，强调 impact、reproduction、expectedResult、actualResult、fixDirection。",
    "对于 Spike，强调 investigationGoal、questionsToAnswer、deliverables、exit criteria。",
    "对于 Story/Task/Improvement，强调 scope、deliverables、acceptanceCriteria、dependencies。",
    "绝不凭空编造账号、租户、URL、端口、服务名、数据库表名、配置键名等具体实现细节。",
    "你必须返回 JSON 对象，不要返回 Markdown。JSON 顶层格式为 {\"ticket\": {...}, \"warnings\": [\"...\"]}。",
    modeInstructions(mode),
    "如果模型不确定 issue type，可沿用预分类结果，但可在输出中说明置信度或待确认点。",
    "优先输出可以直接贴到 JIRA 的内容，而不是分析过程。",
    "以下 few-shot 示例用于对齐风格：",
    examples,
  ].join("\n\n");
}

export function buildUserPrompt(context: PromptContext): string {
  const { rawInput, mode, signals, classification, draft } = context;

  return [
    "请基于以下信息生成或优化 JIRA Ticket。",
    `raw_input: ${rawInput}`,
    `output_mode: ${mode}`,
    `preclassified_issue_type: ${classification.issueType}`,
    `classification_confidence: ${classification.confidence}`,
    `classification_reasons: ${classification.reasons.join("; ")}`,
    `detected_systems: ${signals.systems.join(", ") || "unknown"}`,
    `severity_hints: ${signals.severityHints.join(", ") || "none"}`,
    `missing_info: ${signals.missingInfo.join("; ") || "none"}`,
    "",
    "请在以下 draft 基础上增强质量，但不要无依据地发明具体实施细节：",
    JSON.stringify(draft, null, 2),
    "",
    "输出要求：",
    "1. 标题要清楚体现动作和对象，避免泛化标题。",
    "2. 描述不要简单重复标题，要说明为什么做、做什么、边界是什么。",
    "3. 验收标准要可验证。",
    "4. 明确区分已知信息与推断补全信息。",
    "5. 如果输入信息仍然不足，不要报错，保留 assumptions、openQuestions 和 suggestedFollowUpQuestions。",
  ].join("\n");
}
