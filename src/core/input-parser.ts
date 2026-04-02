import { InputSignals } from "../types/ticket.js";

const SYSTEM_HINTS = [
  "grafana",
  "kong",
  "dp",
  "api gateway",
  "gateway",
  "jenkins",
  "loki",
  "tempo",
  "otel",
  "collector",
  "pipeline",
  "bigquery",
  "onboarding",
];

const ACTION_HINTS = [
  "修复",
  "排查",
  "优化",
  "新增",
  "增加",
  "支持",
  "实现",
  "调研",
  "评估",
  "加",
  "fix",
  "debug",
  "improve",
  "optimize",
  "add",
  "support",
  "enable",
  "investigate",
  "research",
];

const SEVERITY_HINTS = [
  "生产",
  "prod",
  "403",
  "404",
  "500",
  "timeout",
  "失败",
  "错误",
  "无法",
  "empty",
  "经常",
];

export function parseInput(rawInput: string): InputSignals {
  const normalizedInput = rawInput.trim().replace(/\s+/g, " ");
  const lower = normalizedInput.toLowerCase();
  const tokens = lower.split(/[\s/,_-]+/).filter(Boolean);

  const language = /[\u4e00-\u9fa5]/.test(normalizedInput)
    ? /[a-z]/i.test(normalizedInput)
      ? "mixed"
      : "zh"
    : "en";

  const systems = SYSTEM_HINTS.filter((hint) => lower.includes(hint));
  const probableActions = ACTION_HINTS.filter((hint) => lower.includes(hint));
  const severityHints = SEVERITY_HINTS.filter((hint) => lower.includes(hint));

  const missingInfo: string[] = [];
  if (systems.length === 0) {
    missingInfo.push("未明确系统或模块");
  }
  if (!/(生产|prod|测试|staging|dev|环境)/i.test(normalizedInput)) {
    missingInfo.push("未明确影响环境");
  }
  if (!/(因为|导致|impact|影响|为了|目标|用于)/i.test(normalizedInput)) {
    missingInfo.push("未明确业务或技术目标");
  }

  return {
    normalizedInput,
    tokens,
    language,
    systems,
    probableActions,
    severityHints,
    missingInfo,
  };
}
