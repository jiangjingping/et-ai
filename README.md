# WPS-AI 智能表格助手

## 1. 项目概述

WPS-AI 智能表格助手是一个为 WPS Office 表格 (ET) 程序开发的加载项插件。它基于 Vue.js 构建，并集成了先进的大语言模型 (LLM) 能力。

本项目的核心是一个**代码解释器 (Code Interpreter)** Agent，它借鉴了成熟的 Python 数据分析 Agent 的设计思想，使得 AI 能够动态生成并执行 JavaScript 代码（使用 Danfo.js 和 Plotly.js），以完成复杂、多步骤的数据分析和可视化任务。

## 2. 主要功能

*   **AI 对话助手:**
    *   通过 WPS Ribbon UI 启动，在任务窗格中提供现代化的聊天界面。
    *   支持自然语言与 AI 对话，能够引用当前 WPS 表格的数据作为上下文。
    *   支持流式输出，实时反馈 AI 的思考过程。
*   **代码解释器 (核心功能):**
    *   **动态代码生成与执行:** AI 不再依赖固定的工具，而是根据用户请求动态生成 `Danfo.js` 代码来进行数据处理、计算和分析。
    *   **多轮迭代分析:** AI 能够像真正的数据分析师一样，根据上一步的执行结果（或错误）来规划下一步，或进行自我修正，自动完成复杂的分析任务。
    *   **安全沙箱:** 所有由 AI 生成的代码都在一个基于 Web Worker 的隔离沙箱中执行，确保主应用的安全。
    *   **高级可视化:** 利用 `Plotly.js` 生成丰富、可交互的图表。
*   **LLM 配置管理:**
    *   提供图形化界面，允许用户添加、编辑、删除和切换多个大语言模型服务配置。

## 3. 技术栈

*   **前端框架:** Vue.js 3 (Composition API)
*   **构建工具:** Vite
*   **数据处理:** Danfo.js
*   **图表库:** Plotly.js
*   **HTTP 客户端:** Axios, Fetch API
*   **WPS Office 集成:** WPS JSAPI, `wpsjs`
*   **代码规范:** ESLint, Prettier

## 4. 核心工作流程：代码解释器模式

1.  **意图分析**: 用户输入指令后，`IntentAgent` 识别出这是一个需要进行数据分析的任务，并将任务分派给 `CodeInterpreterTool`。
2.  **代码生成 (循环开始)**: `CodeInterpreterTool` 根据用户原始需求和历史执行记录，构建 Prompt，并请求 LLM 以 JSON 格式返回它的**思考 (thought)** 和**要执行的代码 (code)**。
3.  **沙箱执行**: `CodeInterpreterTool` 将收到的 JavaScript 代码发送到 Web Worker 安全沙箱中执行。
4.  **结果反馈**: 沙箱返回执行结果或错误信息。
5.  **反思与迭代**: `CodeInterpreterTool` 将上一步的执行结果作为**反馈**，加入到新的 Prompt 中，让 LLM 决定下一步的**思考**和**代码**。
6.  **循环与结束**: 重复步骤 2-5，直到 LLM 判断任务完成（返回 `continue: false`），循环结束。
7.  **结果呈现**: 最终的分析结论或图表在聊天界面中展示给用户。

## 5. 项目结构

```
.
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── AIChatPanel.vue
│   │   ├── js/
│   │   │   ├── agents/             # Agent 核心逻辑
│   │   │   │   ├── intentAgent.js
│   │   │   │   └── ...
│   │   │   ├── sandboxes/          # 安全沙箱环境
│   │   │   │   ├── sandboxExecutor.js
│   │   │   │   └── webWorkerSandbox.js
│   │   │   ├── tools/              # AI 工具
│   │   │   │   ├── codeInterpreterTool/ # 代码解释器工具模块
│   │   │   │   │   ├── codeInterpreterTool.js
│   │   │   │   │   ├── promptBuilder.js
│   │   │   │   │   └── resultParser.js
│   │   │   │   └── ...
│   │   │   ├── aiService.js
│   │   │   └── ...
│   │   └── ...
│   ├── router/
│   ├── App.vue
│   └── main.js
├── manifest.xml
├── package.json
└── vite.config.js
```

## 6. 安装与运行

### 6.1 环境准备

*   Node.js (推荐LTS版本)
*   WPS Office 桌面版

### 6.2 安装依赖

```bash
npm install
```

### 6.3 开发与调试

```bash
npm run dev
```
该命令会启动 Vite 开发服务器。请在 WPS Office 中以调试模式加载该插件，或直接在浏览器中打开对应的 `localhost` 地址进行界面开发。

### 6.4 构建生产版本

```bash
npm run build
```
构建产物将输出到 `dist` 目录。
