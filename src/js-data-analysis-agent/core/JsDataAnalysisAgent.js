import { parseYaml } from '../utils/yamlParser.js';
import { getSystemPrompt } from './prompts.js';
import aiService from '../../components/js/aiService.js';

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
    async analyze(userInput, data, onProgress) {
        console.log("AGENT: Starting analysis with input:", userInput);
        this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
        this.conversationHistory = [{ role: 'user', content: `User's request: ${userInput}\nData is provided in the 'data' variable.` }];
        
        let finalResult = { report: "Analysis complete.", plotSpec: null };

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
            onProgress({ type: 'llm_thought', round: currentRound, content: parsedResponse.thought });

            if (!parsedResponse || !parsedResponse.action) {
                onProgress({ type: 'error', round: currentRound, content: 'Invalid response from LLM.' });
                break;
            }

            if (parsedResponse.action === 'generate_code') {
                const codeToExecute = parsedResponse.code;
                onProgress({ type: 'code_start', round: currentRound, content: codeToExecute });
                try {
                    const result = await this.executeInWorker(codeToExecute, data);
                    const feedback = `Your code was executed successfully.\n\nOutput:\n\`\`\`json\n${JSON.stringify(result.data, null, 2)}\n\`\`\`\n\nPlease continue with the next step of the analysis.`;
                    this.conversationHistory.push({ role: 'user', content: feedback });
                    onProgress({ type: 'code_end', round: currentRound, content: JSON.stringify(result.data, null, 2) });
                } catch (error) {
                    const feedback = `Your code failed to execute. Please fix it.\n\nError:\n\`\`\`\n${error.message}\n\`\`\`\n\nHere is the code that caused the error:\n\`\`\`javascript\n${parsedResponse.code}\n\`\`\``;
                    this.conversationHistory.push({ role: 'user', content: feedback });
                    onProgress({ type: 'error', round: currentRound, content: error.message });
                }
            } else if (parsedResponse.action === 'generate_plot') {
                onProgress({ type: 'plot', round: currentRound, content: 'Generating plot...' });
                console.log("AGENT: Received plot_spec from LLM.", parsedResponse.plot_spec);
                finalResult.plotSpec = parsedResponse.plot_spec;
                console.log("AGENT: Final result object updated with plotSpec.", finalResult);
                break; 
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
