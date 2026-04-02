import {
  ClassificationResult,
  InputSignals,
  IssueType,
  TicketFieldSet,
} from "../types/ticket.js";

function toTitleCase(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (s) => s.toUpperCase());
}

function inferPriority(issueType: IssueType, signals: InputSignals): string {
  if (issueType === "Bug" && signals.severityHints.some((s) => ["生产", "prod", "403", "500"].includes(s))) {
    return "High";
  }
  if (issueType === "Spike") {
    return "Medium";
  }
  return "Medium";
}

function optimizeSummary(rawInput: string, issueType: IssueType, systems: string[]): string {
  const clean = rawInput.replace(/\s+/g, " ").trim();
  const target = systems[0] ? ` for ${systems[0]}` : "";

  if (issueType === "Bug") {
    return toTitleCase(clean.startsWith("修复") ? clean : `修复 ${clean}`);
  }
  if (issueType === "Spike") {
    return toTitleCase(clean.startsWith("调研") ? clean : `调研 ${clean}`);
  }
  if (issueType === "Improvement") {
    return toTitleCase(clean.startsWith("优化") ? clean : `优化 ${clean}`);
  }
  if (issueType === "Story") {
    return toTitleCase(clean.startsWith("新增") || clean.startsWith("支持") ? clean : `支持 ${clean}${target}`);
  }
  return toTitleCase(clean);
}

function baseAcceptanceCriteria(issueType: IssueType, rawInput: string): string[] {
  if (issueType === "Bug") {
    return [
      "Given 问题复现场景成立，When 执行修复后的路径，Then 不再出现原始错误或异常行为",
      "根因、修复方案与影响范围已记录在 ticket 中，便于后续追踪",
      "至少覆盖 1 个回归验证场景，确保同类问题不会立即复发",
    ];
  }
  if (issueType === "Spike") {
    return [
      "完成调查结论，明确推荐方案、备选方案及其优劣",
      "列出需回答的关键技术问题，并给出结论或待补充项",
      "产出可供后续 Story/Task 使用的落地建议或拆分建议",
    ];
  }
  return [
    `需求“${rawInput}”对应的可交付能力已实现并可验证`,
    "关键配置、边界行为和依赖项已说明清楚",
    "至少提供 1 个可验证的验收场景或检查方式",
  ];
}

export function buildDraftTicket(
  rawInput: string,
  signals: InputSignals,
  classification: ClassificationResult,
): TicketFieldSet {
  const issueType = classification.issueType;
  const systems = signals.systems.length > 0 ? signals.systems : ["待确认模块"];
  const summary = optimizeSummary(rawInput, issueType, systems);
  const commonAssumptions = [
    "该事项面向企业内部研发/平台工程团队",
    "当前输入未提供完整上下游系统边界，描述中仅做保守补全",
  ];

  const ticket: TicketFieldSet = {
    summary,
    issueType,
    background: `用户仅提供了简短输入“${rawInput}”。系统基于常见平台工程与研发流程实践补全了上下文，用于生成可直接进入 backlog refinement 的初稿。`,
    goal:
      issueType === "Bug"
        ? "恢复或稳定相关系统行为，降低用户影响与重复告警风险"
        : issueType === "Spike"
          ? "澄清方案可行性、边界与后续实施路径"
          : "形成一个边界清晰、可执行、可验收的交付项",
    scope: [
      `围绕 ${systems.join(" / ")} 相关能力进行分析与票据补全`,
      "补齐问题背景、交付目标、验收标准与待确认项",
    ],
    outOfScope: [
      "未在输入中出现的跨团队流程改造",
      "未经确认的基础设施大规模重构",
    ],
    description: `该 ticket 由低信息输入自动扩展生成。重点是把模糊表达转成工程团队可执行的任务描述，同时明确假设、风险与待确认项，避免直接把模糊输入提交到研发流程。`,
    acceptanceCriteria: baseAcceptanceCriteria(issueType, rawInput),
    technicalNotes: [
      "优先避免编造具体环境配置、租户 ID、网络拓扑或账号体系细节",
      "若后续接入真实 JIRA API，应将字段映射与项目模板解耦",
    ],
    dependencies: ["待确认是否依赖上游身份认证、网关配置、CI/CD 或可观测性平台"],
    risks: [
      "原始输入过短，生成结果可能遗漏项目特定约束",
      "若缺失环境与影响范围信息，优先级判断可能需要人工修正",
    ],
    assumptions: [...commonAssumptions, ...signals.missingInfo.map((item) => `假设：${item} 需在 refinement 时补充`)],
    openQuestions: [
      "影响环境是生产、预发还是测试环境？",
      "该事项的成功标准更偏业务结果还是技术结果？",
      "是否存在明确的上下游依赖系统或 owner？",
    ],
    suggestedFollowUpQuestions: [
      "请补充影响范围、紧急程度和目标环境",
      "如果是 Bug，请补充复现步骤、期望结果和实际结果",
      "如果是新增能力，请补充使用方、交付方式和非目标范围",
    ],
    prioritySuggestion: inferPriority(issueType, signals),
    labelsSuggestion: Array.from(new Set(["ai-generated", issueType.toLowerCase(), ...systems.map((s) => s.replace(/\s+/g, "-"))])),
    componentsSuggestion: systems,
    knownInformation: [
      `原始输入：${rawInput}`,
      `识别模块：${systems.join(", ")}`,
      `分类结果：${issueType}`,
    ],
    inferredInformation: [
      "补全了背景、目标、范围、验收标准和风险",
      "对缺失信息生成了假设与待确认项",
    ],
  };

  if (issueType === "Bug") {
    ticket.problemStatement = `当前在 ${systems.join(" / ")} 相关场景中出现异常，初步判断已影响正常使用、可观测性或交付稳定性。`;
    ticket.impact = "可能影响内部用户访问、链路稳定性、数据完整性或排障效率。";
    ticket.reproductionSteps = [
      "进入相关系统或链路入口",
      "执行当前输入所描述的操作路径",
      "记录错误码、日志、网关响应和时间窗口",
    ];
    ticket.expectedResult = "系统行为恢复正常，相关错误不再复现或有明确降级说明。";
    ticket.actualResult = "当前存在失败、错误响应、会话异常或链路数据缺失。";
    ticket.fixDirection = [
      "先确认根因属于鉴权、配置、数据格式还是上下游依赖",
      "补充最小修复方案与回归验证路径",
    ];
  }

  if (issueType === "Spike") {
    ticket.investigationGoal = `澄清“${rawInput}”的可行方案、关键约束与实施建议。`;
    ticket.questionsToAnswer = [
      "当前方案目标是什么，成功标准如何定义？",
      "是否有现有平台能力可复用？",
      "风险、成本和依赖分别是什么？",
    ];
    ticket.deliverables = [
      "调查结论文档或 ticket 内结论摘要",
      "推荐方案及备选方案比较",
      "后续实现建议或子任务拆分",
    ];
  }

  if (issueType === "Story" || issueType === "Task" || issueType === "Improvement") {
    ticket.deliverables = [
      "清晰的实现项说明",
      "可验证的交付结果",
      "必要的配置、文档或运行说明",
    ];
  }

  return ticket;
}
