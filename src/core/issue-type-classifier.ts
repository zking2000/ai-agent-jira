import { ClassificationResult, InputSignals, IssueType } from "../types/ticket.js";

interface Rule {
  type: IssueType;
  patterns: RegExp[];
  score: number;
  reason: string;
}

const RULES: Rule[] = [
  {
    type: "Bug",
    patterns: [/修复|无法|失败|错误|403|404|500|timeout|empty|退出登录|login/i],
    score: 4,
    reason: "输入包含故障、报错、异常或可感知缺陷信号",
  },
  {
    type: "Spike",
    patterns: [/调研|评估|investigate|research|feasibility|排查/i],
    score: 4,
    reason: "输入更像探索、验证或原因定位工作",
  },
  {
    type: "Improvement",
    patterns: [/优化|提升|improve|optimize|reduce/i],
    score: 3,
    reason: "输入强调性能、可观测性或质量改进",
  },
  {
    type: "Story",
    patterns: [/新增|增加|支持|实现|enable|add|support/i],
    score: 3,
    reason: "输入强调新增能力或功能交付",
  },
  {
    type: "Task",
    patterns: [/配置|接入|迁移|审计|integration|pipeline|接收/i],
    score: 2,
    reason: "输入偏向技术执行项而非独立产品能力",
  },
  {
    type: "Epic",
    patterns: [/平台建设|体系|整体方案|multi-team|program/i],
    score: 5,
    reason: "输入粒度偏大，可能需要拆分多个子任务",
  },
];

export function classifyIssueType(signals: InputSignals): ClassificationResult {
  const text = signals.normalizedInput;
  const scores = new Map<IssueType, number>();
  const reasons = new Map<IssueType, string[]>();

  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      scores.set(rule.type, (scores.get(rule.type) || 0) + rule.score);
      reasons.set(rule.type, [...(reasons.get(rule.type) || []), rule.reason]);
    }
  }

  if (signals.severityHints.length > 0) {
    scores.set("Bug", (scores.get("Bug") || 0) + 1);
    reasons.set("Bug", [...(reasons.get("Bug") || []), "存在环境/错误码/异常频次等风险提示"]);
  }

  if (signals.systems.length > 0 && !scores.has("Task")) {
    scores.set("Task", 1);
    reasons.set("Task", ["识别到明确技术对象，至少可落为工程执行任务"]);
  }

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, score]) => ({ type, score }));

  const top = ranked[0] || { type: "Task" as IssueType, score: 1 };
  const confidence = Math.min(0.95, 0.45 + top.score * 0.1);

  return {
    issueType: top.type,
    confidence,
    reasons: reasons.get(top.type) || ["默认归类为可执行工程任务"],
    candidateTypes: ranked.length > 0 ? ranked : [{ type: "Task", score: 1 }],
  };
}
