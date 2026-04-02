import { FewShotExample } from "../types/ticket.js";

export const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  {
    rawInput: "grafana 登录403",
    classifiedIssueType: "Bug",
    whyClassification: "包含明确异常现象与错误码，优先按缺陷处理。",
    inferredContent: [
      "补全了影响路径、期望结果、修复方向与回归验证要求",
      "未假设具体身份源、路由规则或租户配置",
    ],
    structuredTicket: {
      summary: "修复 grafana 登录 403 问题",
      issueType: "Bug",
      problemStatement: "Grafana 登录流程返回 403，阻塞正常访问。",
      acceptanceCriteria: [
        "Grafana 登录流程不再返回 403",
        "至少完成 1 条登录回归验证路径",
      ],
    },
  },
  {
    rawInput: "给 kong dp 加 tracing",
    classifiedIssueType: "Story",
    whyClassification: "表达为新增工程能力，目标是可交付的能力建设。",
    inferredContent: [
      "补全了范围、交付物、技术备注和可验收项",
      "未假设具体 tracing backend 或采样率",
    ],
    structuredTicket: {
      summary: "支持 kong dp tracing 能力",
      issueType: "Story",
      acceptanceCriteria: [
        "Kong DP 请求链路可生成 trace 数据",
        "至少 1 条链路可在观测平台中被检索与查看",
      ],
    },
  },
  {
    rawInput: "jenkins pipeline audit",
    classifiedIssueType: "Task",
    whyClassification: "更像平台侧技术交付项，重点在接入与落库能力。",
    inferredContent: [
      "补全为审计数据采集、存储与可查询的工程任务",
    ],
    structuredTicket: {
      summary: "实现 Jenkins pipeline 审计能力",
      issueType: "Task",
    },
  },
  {
    rawInput: "调研 grafana 多租户方案",
    classifiedIssueType: "Spike",
    whyClassification: "输入明确为调研动作，应输出调查目标、问题列表与退出条件。",
    inferredContent: [
      "补全为方案调研 ticket，而非直接实现项",
    ],
    structuredTicket: {
      summary: "调研 grafana 多租户方案",
      issueType: "Spike",
    },
  },
  {
    rawInput: "优化 loki 日志标签",
    classifiedIssueType: "Improvement",
    whyClassification: "输入强调优化，通常对应质量、成本或可观测性改进。",
    inferredContent: [
      "补全了标签规范、查询效果和数据质量验收方向",
    ],
    structuredTicket: {
      summary: "优化 loki 日志标签",
      issueType: "Improvement",
    },
  },
];
