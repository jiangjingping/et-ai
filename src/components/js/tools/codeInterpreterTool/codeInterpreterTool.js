/**
 * codeInterpreterTool.js
 *
 * 这是代码解释器工具的核心逻辑。它负责协调生成和执行代码以回答用户查询的过程。
 */

import { BaseTool } from '../baseTool.js';
import aiService from '../../aiService.js';
import { executeInSandbox } from '../../sandboxes/sandboxExecutor.js';
import { buildPrompt } from './promptBuilder.js';
import { parseSandboxResult } from './resultParser.js';

class CodeInterpreterTool extends BaseTool {
    constructor() {
        super(
            "code_interpreter",
            "Dynamically generates and executes JavaScript code (using Danfo.js and Plotly.js) to perform advanced data analysis, transformations, and visualizations. Use this for any request that involves calculations, data manipulation, or charting.",
            ["js_code_generation", "data_analysis", "visualization"]
        );
    }

    /**
     * 执行分析逻辑的一个步骤。
     * @param {string} userInput - 用户的原始请求。
     * @param {Array<object>} tableData - 来自表格的数据。
     * @param {Array} history - 当前会话的执行历史。
     * @returns {Promise<object>} - 一个解析为当前步骤结果的 Promise。
     */
    async execute(userInput, tableData, history = []) {
        if (!tableData || tableData.length === 0) {
            return { success: false, content: "❌ The Code Interpreter Tool requires table data to be attached." };
        }

        try {
            // 1. 构建给LLM的提示，包含历史记录
            const tableDataAsJson = JSON.stringify(tableData);
            const { systemPrompt, userPrompt } = buildPrompt(userInput, tableDataAsJson, history);

            // 2. 以JSON模式调用LLM以获取结构化响应
            const llmResponse = await aiService.callQwenAPI(userPrompt, systemPrompt, { jsonMode: true });
            const responseData = JSON.parse(llmResponse.content);

            const { thought, code, continue: shouldContinue, final_answer, plotlyConfig } = responseData;

            // 如果LLM认为任务已完成，则返回最终答案
            if (!shouldContinue) {
                return {
                    success: true,
                    continue: false,
                    thought: thought,
                    content: final_answer,
                    plotlyConfig: plotlyConfig
                };
            }
            
            if (!code || code.trim() === '') {
                // 如果LLM希望继续但没有提供任何代码，说明出了问题。
                throw new Error("LLM决定继续执行但未提供任何代码。");
            }

            // 3. 在沙箱中执行生成的代码
            let sandboxResult;
            let isSuccess = false;
            try {
                // 注意：沙箱当前在两次执行之间不维护状态。
                // 对于需要保留变量的真正多步骤逻辑，沙箱需要增强。
                // 目前，我们在每个步骤前都重新注入数据加载代码。
                const fullCode = `const data = \`${tableDataAsJson}\`;\n${code}`;
                sandboxResult = await executeInSandbox(fullCode);
                isSuccess = true;
            } catch (executionError) {
                sandboxResult = executionError;
                isSuccess = false;
            }

            // 4. 解析沙箱返回的结果
            const parsedResult = parseSandboxResult(sandboxResult, isSuccess);

            return {
                success: isSuccess,
                continue: true,
                thought: thought,
                code: code,
                result: parsedResult.success ? parsedResult : null,
                error: !isSuccess ? parsedResult.content : null,
                plotlyConfig: parsedResult.success ? parsedResult.plotlyConfig : null
            };

        } catch (error) {
            console.error(`❌ Error in CodeInterpreterTool: ${error.message}`);
            return {
                success: false,
                type: 'error',
                content: `An internal error occurred in the Code Interpreter Tool: ${error.message}`
            };
        }
    }
}

export default CodeInterpreterTool;
