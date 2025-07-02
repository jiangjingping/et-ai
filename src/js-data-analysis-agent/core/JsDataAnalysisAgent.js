import { parseYaml } from '../utils/yamlParser.js';
import { getSystemPrompt } from './prompts.js';
import aiService from '../../components/js/aiService.js';
import jsyaml from 'js-yaml';

export class JsDataAnalysisAgent {
    constructor() {
        this.conversationHistory = [];
        this.worker = null;
    }

    /**
     * 启动数据分析流程。
     * @param {string} userInput 用户的自然语言查询。
     * @param {Array<Object>} data 要分析的数据 (例如, 对象数组)。
     * @returns {Promise<object>} 一个 Promise，最终解析为包含分析报告的对象。
     */
    async analyze(userInput, initialData, onProgress) {
        console.log("AGENT: 使用输入启动分析:", userInput);
        this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
        this.conversationHistory = [{ role: 'user', content: `用户请求: ${userInput}\n数据在 'data' 变量中提供。` }];
        
        let finalResult = { report: "分析完成。", plotSpec: null };
        let workingData = initialData; // 使用一个可变变量来存储数据

        for (let i = 0; i < 10; i++) { // 限制最多10轮
            const currentRound = i + 1;
            onProgress({ type: 'llm_start', round: currentRound, content: `第 ${currentRound} 轮` });

            const prompt = this.conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n\n');
            const systemPrompt = getSystemPrompt();
            
            const llmResponse = await new Promise((resolve, reject) => {
                let accumulatedContent = '';
                aiService.callQwenAPIStream(
                    prompt,
                    systemPrompt,
                    (chunk, newAccumulatedContent) => {
                        accumulatedContent = newAccumulatedContent;
                        onProgress({ type: 'llm_stream', round: currentRound, content: chunk, accumulatedContent: newAccumulatedContent });
                    },
                    (finalContent) => {
                        console.log("AGENT: LLM 流结束。完整响应:", finalContent || accumulatedContent);
                        this.conversationHistory.push({ role: 'assistant', content: finalContent || accumulatedContent });
                        resolve(finalContent || accumulatedContent);
                    },
                    (error) => {
                        console.error("AGENT: LLM 流失败:", error);
                        reject(error);
                    }
                );
            });
            
            const parsedResponse = parseYaml(llmResponse);
            
            let thoughtContent = parsedResponse.thought;
            let thought = {};

            if (typeof thoughtContent === 'string') {
                try {
                    // 尝试将 thought 字符串本身作为 YAML 解析
                    const nestedParsed = jsyaml.load(thoughtContent);
                    if (typeof nestedParsed === 'object' && nestedParsed !== null) {
                        thought = nestedParsed;
                    } else {
                        // 如果解析出来不是对象，就当成纯文本
                        thought = { text: thoughtContent };
                    }
                } catch (e) {
                    // 解析失败，也当成纯文本
                    thought = { text: thoughtContent };
                }
            } else if (typeof thoughtContent === 'object' && thoughtContent !== null) {
                thought = thoughtContent;
            }

            // 确保有 title 和 text
            thought.title = thought.title || '思考';
            thought.text = thought.text || (typeof thoughtContent === 'string' ? thoughtContent : '正在分析...');

            onProgress({ type: 'llm_thought', round: currentRound, content: thought });

            if (!parsedResponse || !parsedResponse.action) {
                onProgress({ type: 'error', round: currentRound, content: '从LLM收到了无效的响应。' });
                break;
            }

            if (parsedResponse.action === 'generate_code') {
                const codeToExecute = parsedResponse.code;
                onProgress({ type: 'code_start', round: currentRound, content: codeToExecute });
                try {
                    const result = await this.executeInWorker(codeToExecute, workingData);
                    // 关键: 用 Worker 返回的完整结果更新工作数据
                    workingData = result.data.full_data; 
                    
                    // 为了反馈，只显示摘要以避免token限制问题
                    const outputSummary = JSON.stringify(result.data.summary, null, 2);
                    const feedback = `你的代码已成功执行。\n\n输出 (摘要):\n\`\`\`json\n${outputSummary}\n\`\`\`\n\n请继续下一步分析。完整数据集已为你的下一步行动更新。`;
                    
                    this.conversationHistory.push({ role: 'user', content: feedback });
                    onProgress({ type: 'code_end', round: currentRound, content: outputSummary });
                } catch (error) {
                    const feedback = `你的代码执行失败。请修复它。\n\n错误:\n\`\`\`\n${error.message}\n\`\`\`\n\n这是导致错误的代码:\n\`\`\`javascript\n${parsedResponse.code}\n\`\`\``;
                    this.conversationHistory.push({ role: 'user', content: feedback });
                    onProgress({ type: 'error', round: currentRound, content: error.message });
                }
            } else if (parsedResponse.action === 'generate_chart_from_code') {
                const codeToExecute = parsedResponse.code;
                onProgress({ type: 'plot', round: currentRound, content: '正在生成图表...' });
                try {
                    // 将最新的 workingData 传递给图表生成代码
                    const result = await this.executeInWorker(codeToExecute, workingData);
                    finalResult.plotSpec = result.data; // worker 现在返回 spec 对象
                    console.log("AGENT: 最终结果对象已通过生成的代码更新 plotSpec。", finalResult);
                    break;
                } catch (error) {
                    const feedback = `你的图表生成代码执行失败。请修复它。\n\n错误:\n\`\`\`\n${error.message}\n\`\`\`\n\n这是导致错误的代码:\n\`\`\`javascript\n${parsedResponse.code}\n\`\`\``;
                    this.conversationHistory.push({ role: 'user', content: feedback });
                    onProgress({ type: 'error', round: currentRound, content: error.message });
                }
            } else if (parsedResponse.action === 'analysis_complete') {
                onProgress({ type: 'complete', round: currentRound, content: '分析完成。' });
                finalResult.report = parsedResponse.final_report;
                break;
            }
        }

        this.worker.terminate();
        return finalResult;
    }

    /**
     * 在 Web Worker 中执行代码。
     * @param {string} code 要执行的 JavaScript 代码。
     * @param {any} data 将在 worker 作用域中可用的数据。
     * @returns {Promise<any>} 一个 Promise，最终解析为从 worker 返回的结果。
     */
    executeInWorker(code, data) {
        return new Promise((resolve, reject) => {
            this.worker.onmessage = (event) => {
                if (event.data.success) {
                    resolve(event.data);
                } else {
                    reject(new Error(event.data.error));
                }
            };

            this.worker.onerror = (error) => {
                reject(error);
            };

            this.worker.postMessage({ code, data });
        });
    }
}
