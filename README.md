# AI Agent JIRA

一个适合企业内部使用的 JIRA Ticket 生成助手项目骨架。它的目标不是把用户输入原样润色，而是把一句很短、很粗糙的输入扩展成一个更专业、更可执行、更适合研发协作流转的 ticket draft。

项目当前提供：

- `CLI` 运行入口
- 规则引擎式 `issue type` 分类
- 低信息输入兜底 draft 生成
- 可替换的 `LLM` 抽象层
- `Jira Cloud API` 直接建票能力
- 基于路由规则的 `project / assignee / epic / priority / custom fields` 自动推断
- 自动查询 Jira metadata，降低手工查字段和账号 ID 的成本
- 创建成功后自动保存本地记录
- 多种输出模式：`minimal`、`standard`、`detailed`、`jira_markup`、`json`
- 多种渲染格式：`markdown`、`jira`、`json`
- few-shot 示例与 prompt 模板
- 质量检查与标题/验收标准规范化

## 技术选型

默认方案采用 `TypeScript + Node.js + CLI`。

原因：

- 适合企业内网、本地开发机和 CI 环境快速落地
- 便于后续扩展为 Web API、JIRA API 集成、前端页面或 Cursor/插件集成
- 类型系统利于维护复杂 ticket 结构与多模板输出
- Node 生态对 LLM SDK、CLI、配置管理和后续服务化都比较成熟

如果后续需要 Web 服务，可以在当前核心模块不变的前提下增加：

- `Fastify/Express` API 层
- `Next.js` 管理台或表单 UI
- `JIRA API` 写入适配器

## 架构概览

核心数据流如下：

1. 用户输入一句短文本
2. `input-parser` 做标准化、系统识别、动作识别、缺失信息识别
3. `issue-type-classifier` 结合规则进行类型打分
4. `ticket-enricher` 先生成一个稳定的规则草稿
5. `prompt-builder` 把草稿、分类结果、few-shot 示例拼成 LLM 请求
6. `llm-client` 可选增强内容质量
7. `response-parser` 解析 LLM JSON 输出，失败时回退到规则草稿
8. `quality-checker` 修正标题、验收标准并补充警告
9. `ticket-formatter` 输出为 Markdown / JIRA Markup / JSON
10. `jira-routing` 基于关键词、系统、issue type 做 Jira 路由决策
11. `jira-client` 将统一 ticket 数据结构映射并创建到真实 Jira
12. `jira-record-store` 保存本地创建记录，便于审计与追踪
13. `jira-metadata` 拉取字段、优先级、组件、issue type、可分配用户，并生成路由配置

这样设计的原因：

- 不把质量完全押注在一次 prompt 上
- 即使没有 LLM，也能生成“像样的 ticket 初稿”
- 便于后续接入不同模型供应商
- 便于支持不同项目模板、团队风格和语言

## 目录结构

```text
ai-agent-jira/
├── .env.example
├── config/
│   └── jira-routing.example.json
├── package.json
├── tsconfig.json
├── README.md
├── examples/
│   └── sample-inputs.json
└── src/
    ├── index.ts
    ├── config.ts
    ├── logger.ts
    ├── core/
    │   ├── input-parser.ts
    │   ├── issue-type-classifier.ts
    │   ├── prompt-builder.ts
    │   ├── quality-checker.ts
    │   ├── response-parser.ts
    │   ├── ticket-enricher.ts
    │   └── ticket-service.ts
    ├── formatters/
    │   └── index.ts
    ├── integrations/
    │   ├── jira-client.ts
    │   ├── jira-metadata.ts
    │   ├── jira-record-store.ts
    │   └── jira-routing.ts
    ├── llm/
    │   ├── base.ts
    │   ├── mock-client.ts
    │   └── openai-client.ts
    ├── templates/
    │   ├── few-shot.ts
    │   └── system-prompt.ts
    └── types/
        └── ticket.ts
```

## 模块职责

### `input-parser`

- 清洗输入
- 识别语言、模块、动作、严重度提示
- 提取缺失信息提示

### `issue-type-classifier`

- 用规则做初步分类和打分
- 输出主类型、候选类型、置信度和原因
- 为低信息输入提供稳定分类兜底

### `ticket-enricher`

- 基于分类结果生成首版 structured ticket
- 自动补全 assumptions、open questions、follow-up questions
- 按不同 issue type 填充不同字段

### `prompt-builder`

- 组装系统提示词和用户提示词
- 注入 few-shot 示例
- 约束 LLM 返回结构化 JSON

### `llm-client`

- 屏蔽模型提供商差异
- 当前提供 `mock` 与 `openai`
- 未来可扩展为 Azure OpenAI、Anthropic、内部网关等

### `quality-checker`

- 标题质量修正
- 验收标准规范化
- 输出风险和质量警告

### `ticket-formatter`

- 将统一 ticket 数据结构格式化为 Markdown / JIRA / JSON

### `jira-client`

- 使用 Jira Cloud REST API 直接创建 issue
- 自动解析项目可用 issue type，并做合理映射
- 自动按项目现有组件匹配 `componentsSuggestion`
- 将结构化 ticket 转换为 Jira ADF 描述

### `jira-routing`

- 用配置文件承载自动路由规则，而不是把分派逻辑写死在代码里
- 支持根据 `keywords / systems / issueTypes / labels / priorities` 自动推断：
- `projectKey`
- `assigneeAccountId`
- `epicKey`
- `priorityName`
- `components`
- `customFields`

### `jira-record-store`

- 将每次建票结果保存到本地 `jsonl`
- 记录原始输入、Jira key、浏览链接、路由决策和最终 ticket 快照

### `jira-metadata`

- 自动抓取 Jira metadata
- 保存字段、优先级、项目、组件、issue type、assignable users 的本地缓存
- 自动推断 `Epic Link` 字段 ID
- 自动生成或刷新 `config/jira-routing.json`

## Prompt 设计原则

项目没有把逻辑全部塞进一个 prompt，而是采用 “规则先行 + LLM 增强” 的策略：

- 第一层：规则分类与字段兜底，避免输入过短时完全失控
- 第二层：few-shot 示例对齐风格
- 第三层：严格要求 LLM 只输出 JSON
- 第四层：响应解析失败时自动回退到规则草稿
- 第五层：质量检查器二次修正标题和验收标准

Hallucination reduction 策略：

- 在 system prompt 中明确禁止编造具体环境细节
- 把已知信息与推断信息分开
- 对缺失信息生成 assumptions 和 open questions，而不是假装已知
- 允许输出“待确认项”，优先保守补全

## 安装

```bash
npm install
```

## 配置

复制配置文件：

```bash
cp .env.example .env
```

可选配置：

```env
LLM_PROVIDER=openai
LLM_BASE_URL=http://127.0.0.1:4000/v1
LLM_API_KEY=local-proxy
LLM_MODEL=gpt-4.1-mini
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your_jira_api_token
JIRA_PROJECT_KEY=PLAT
JIRA_DEFAULT_ASSIGNEE_ACCOUNT_ID=
JIRA_EPIC_LINK_FIELD_ID=customfield_10014
JIRA_ROUTING_CONFIG=config/jira-routing.json
JIRA_RECORD_DIR=data/jira-records
JIRA_METADATA_DIR=data/jira-metadata
DEFAULT_OUTPUT_MODE=standard
DEFAULT_FORMAT=markdown
LOG_LEVEL=info
```

推荐直接使用本地或企业内的 OpenAI 兼容代理。只要代理暴露兼容 `/v1` 的接口，就可以通过 `LLM_BASE_URL` 接入。

例如：

```env
LLM_PROVIDER=openai
LLM_BASE_URL=http://127.0.0.1:4000/v1
LLM_API_KEY=local-proxy
LLM_MODEL=qwen2.5-14b-instruct
```

说明：

- `LLM_PROVIDER=openai` 在这里表示“使用 OpenAI SDK 的兼容协议”，不代表一定直连官方。
- `LLM_BASE_URL` 指向你的本地代理地址。
- `LLM_API_KEY` 对很多本地代理来说可以是任意非空字符串。
- 项目同时兼容旧变量名 `OPENAI_BASE_URL`、`OPENAI_API_KEY`、`OPENAI_MODEL`。

如果暂时不想接任何模型，可以把 `LLM_PROVIDER` 设为 `mock`，系统仍可用规则引擎生成 draft。

如果要直接创建 Jira issue，请补齐以下配置：

- `JIRA_BASE_URL`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`
- `JIRA_PROJECT_KEY`

如果要启用“最少输入自动路由”，建议再配置：

- `JIRA_EPIC_LINK_FIELD_ID`
- `JIRA_ROUTING_CONFIG`
- `JIRA_DEFAULT_ASSIGNEE_ACCOUNT_ID`

说明：

- 当前实现优先支持 `Jira Cloud`
- 认证方式为 `email + API token`
- issue 创建使用 `/rest/api/3/issue`
- 描述字段自动转换为 Jira ADF 文档结构
- `config/jira-routing.json` 可覆盖项目、经办人、Epic 和自定义字段的自动推断
- 创建记录默认保存到 `data/jira-records/*.jsonl`
- metadata 缓存默认保存到 `data/jira-metadata/*.json`

推荐先复制一份路由配置：

```bash
cp config/jira-routing.example.json config/jira-routing.json
```

如果你已经配好了 Jira 凭据，推荐直接跑一遍 metadata 同步和 routing 生成：

```bash
npm run dev -- sync-metadata --projects PLAT,OBS,DEVOPS
npm run dev -- bootstrap-routing --projects PLAT,OBS,DEVOPS
```

## 运行

开发模式：

```bash
npm run dev -- generate --input "grafana 登录403" --mode standard --format markdown --no-llm
```

直接创建 Jira issue：

```bash
npm run dev -- create --input "生产 grafana 经常自动退出登录" --mode standard
```

指定项目 Key：

```bash
npm run dev -- create --input "给 kong dp 加 tracing" --project PLAT
```

只预览将要创建的 Jira 内容，不真正建票：

```bash
npm run dev -- create --input "grafana 登录403" --dry-run
```

预览时除了 ticket 内容，还会显示：

- 自动选择的 `project`
- 自动匹配的 `issue type`
- 自动推断的 `priority`
- 自动指定的 `assignee`
- 自动挂接的 `epic`
- 自动写入的 `custom fields`
- 命中的路由规则

同步 Jira metadata：

```bash
npm run dev -- sync-metadata --projects PLAT,OBS,DEVOPS
```

基于 Jira metadata 自动生成 routing 配置：

```bash
npm run dev -- bootstrap-routing --projects PLAT,OBS,DEVOPS --print
```

查看 few-shot 示例：

```bash
npm run dev -- examples
```

构建：

```bash
npm run build
```

运行构建后的版本：

```bash
npm start -- generate --input "给 kong dp 加 tracing" --mode detailed --format jira
```

使用本地 LLM 代理：

```bash
LLM_PROVIDER=openai \
LLM_BASE_URL=http://127.0.0.1:4000/v1 \
LLM_API_KEY=local-proxy \
LLM_MODEL=qwen2.5-14b-instruct \
npm run dev -- generate --input "grafana 登录403" --mode standard --format markdown
```

## 输出模式

### `minimal`

适合快速建票，只保留：

- `summary`
- `issueType`
- `description`
- `acceptanceCriteria`

### `standard`

默认模式，输出常规结构化 ticket。

### `detailed`

更强调：

- `dependencies`
- `risks`
- `assumptions`
- `openQuestions`

### `jira_markup`

适合直接粘贴到 JIRA 描述栏。

### `json`

适合对接 API、Web UI、自动建票流程。

## 示例命令

```bash
npm run dev -- generate --input "grafana 登录403" --mode standard --format markdown --no-llm
```

```bash
npm run dev -- generate --input "调研 grafana 多租户方案" --mode detailed --format jira --no-llm
```

```bash
npm run dev -- generate --input "优化 loki 日志标签" --mode json --format json --no-llm
```

```bash
npm run dev -- create --input "jenkins pipeline audit" --project DEVOPS
```

## 自动路由最佳实践

为了让用户只输入一句话也能正确建票，建议把组织知识沉淀到 `config/jira-routing.json`：

- 按系统域拆规则，例如 `grafana / loki / tempo / otel`
- 按平台域拆规则，例如 `jenkins / pipeline / gateway / kong`
- 为每类规则预设：
- 默认 project
- 默认 assignee accountId
- 默认 epicKey
- 默认 labels / components
- 所需 custom fields

这样最终用户只输入：

```text
grafana 登录403
```

系统也能自动做出一整套决策：

- 生成高质量 ticket
- 自动归到正确项目
- 自动指定 assignee
- 自动挂接 epic
- 自动带上 custom fields
- 自动建票并返回链接
- 自动保存本地记录

## 这两项功能的实际好处

### 1. 定制 `config/jira-routing.json`

好处是把团队知识前置沉淀成规则，而不是每次建票都靠人临时补：

- 你只输一句话，系统也能自动决定归哪个项目
- 能按领域自动选 assignee / epic / labels / components
- 同类 ticket 的建票方式更稳定，不依赖个人经验
- 后续团队扩展时，只改配置，不用改代码

### 2. 自动查询 Jira metadata

好处是减少你手工找 Jira 元信息的时间成本：

- 不用手查 `customfield_xxxxx`
- 不用手查项目支持哪些 issue type
- 不用手查组件名拼写
- 不用手查 priority 的实际名称
- 不用手查可分配用户账号 ID
- 可以自动建议 `Epic Link` 字段 ID

两者结合后的价值是：

- 前期配置成本更低
- 后续维护成本更低
- 自动建票的正确率更高
- 更适合“我只给最少必要信息，其余都让系统补齐”的使用方式

## 5 个示例输入与预期方向

### 1. `grafana 登录403`

- 分类：`Bug`
- 重点：影响、复现、期望结果、修复方向、回归验证

### 2. `给 kong dp 加 tracing`

- 分类：`Story`
- 重点：新增能力、交付范围、接入方式、验收链路

### 3. `jenkins pipeline audit`

- 分类：`Task`
- 重点：审计数据采集、落地、查询与运维边界

### 4. `调研 grafana 多租户方案`

- 分类：`Spike`
- 重点：调查目标、待回答问题、输出物、退出条件

### 5. `优化 loki 日志标签`

- 分类：`Improvement`
- 重点：查询质量、标签规范、成本与可观测性收益

## 后续扩展建议

建议按以下方向迭代：

1. 增加 `project templates`，支持不同团队的字段风格、默认 labels、组件和优先级策略。
2. 增加 `history-based learning`，基于历史 ticket 做风格对齐和字段建议。
3. 增加 `REST API` 和简易 Web UI，便于内部工具接入。
4. 增加 `bilingual output`，支持中英文 ticket。
5. 增加 `evaluation dataset`，对标题质量、分类准确率、验收标准质量做离线评估。
6. 支持 Reporter、Watcher、Sprint、Parent Link 等更多 Jira 字段自动映射。

## 设计原则总结

把一句话扩展成高质量 ticket 的核心，不是“写得更长”，而是：

- 先判断它是什么类型的事项
- 明确哪些信息是已知、哪些只是合理推断
- 把模糊描述转为目标、范围、风险、验收标准
- 即使信息不足，也要生成可以进入 refinement 的 draft
- 在工程结构上预留模型替换、JIRA API 接入和团队模板扩展能力
