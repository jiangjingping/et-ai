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
     * Starts the data analysis process.
     * @param {string} userInput The user's natural language query.
     * @param {Array<Object>} data The data to be analyzed (e.g., array of objects).
     * @returns {Promise<object>} A promise that resolves with the final analysis report.
     */
    async analyze(userInput, initialData, onProgress) {
        console.log("AGENT: Starting analysis with input:", userInput);
        this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
        this.conversationHistory = [{ role: 'user', content: `User's request: ${userInput}\nData is provided in the 'data' variable.` }];
        
        let finalResult = { report: "Analysis complete.", plotSpec: null };
        let workingData = initialData; // Use a mutable variable for data

        for (let i = 0; i < 10; i++) { // Limit to 10 rounds
            const currentRound = i + 1;
            onProgress({ type: 'llm_start', round: currentRound, content: `Round ${currentRound}` });

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
                        console.log("AGENT: LLM Stream finished. Full response:", finalContent || accumulatedContent);
                        this.conversationHistory.push({ role: 'assistant', content: finalContent || accumulatedContent });
                        resolve(finalContent || accumulatedContent);
                    },
                    (error) => {
                        console.error("AGENT: LLM Stream failed:", error);
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
                onProgress({ type: 'error', round: currentRound, content: 'Invalid response from LLM.' });
                break;
            }

            if (parsedResponse.action === 'generate_code') {
                const codeToExecute = parsedResponse.code;
                onProgress({ type: 'code_start', round: currentRound, content: codeToExecute });
                try {
                    const result = await this.executeInWorker(codeToExecute, workingData);
                    // CRITICAL: Update the working data with the full result from the worker
                    workingData = result.data.full_data; 
                    
                    // For feedback, only show a summary to avoid token limit issues
                    const outputSummary = JSON.stringify(result.data.summary, null, 2);
                    const feedback = `Your code was executed successfully.\n\nOutput (summary):\n\`\`\`json\n${outputSummary}\n\`\`\`\n\nPlease continue with the next step of the analysis. The full dataset has been updated for your next action.`;
                    
                    this.conversationHistory.push({ role: 'user', content: feedback });
                    onProgress({ type: 'code_end', round: currentRound, content: outputSummary });
                } catch (error) {
                    const feedback = `Your code failed to execute. Please fix it.\n\nError:\n\`\`\`\n${error.message}\n\`\`\`\n\nHere is the code that caused the error:\n\`\`\`javascript\n${parsedResponse.code}\n\`\`\``;
                    this.conversationHistory.push({ role: 'user', content: feedback });
                    onProgress({ type: 'error', round: currentRound, content: error.message });
                }
            } else if (parsedResponse.action === 'generate_chart_from_code') {
                const codeToExecute = parsedResponse.code;
                onProgress({ type: 'plot', round: currentRound, content: 'Generating plot...' });
                try {
                    // Pass the most up-to-date workingData to the chart generation code
                    const result = await this.executeInWorker(codeToExecute, workingData);
                    finalResult.plotSpec = result.data; // The worker now returns the spec object
                    console.log("AGENT: Final result object updated with plotSpec from generated code.", finalResult);
                    break;
                } catch (error) {
                    const feedback = `Your chart generation code failed to execute. Please fix it.\n\nError:\n\`\`\`\n${error.message}\n\`\`\`\n\nHere is the code that caused the error:\n\`\`\`javascript\n${parsedResponse.code}\n\`\`\``;
                    this.conversationHistory.push({ role: 'user', content: feedback });
                    onProgress({ type: 'error', round: currentRound, content: error.message });
                }
            } else if (parsedResponse.action === 'analysis_complete') {
                onProgress({ type: 'complete', round: currentRound, content: 'Analysis complete.' });
                finalResult.report = parsedResponse.final_report;
                break;
            }
        }

        this.worker.terminate();
        return finalResult;
    }

    /**
     * Executes code in the Web Worker.
     * @param {string} code The JavaScript code to execute.
     * @param {any} data The data to be available in the worker's scope.
     * @returns {Promise<any>} A promise that resolves with the result from the worker.
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
