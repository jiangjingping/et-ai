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
        console.log("Starting analysis with input:", userInput);
        this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
        this.conversationHistory = [{ role: 'user', content: `User's request: ${userInput}\nData is provided in the 'data' variable.` }];
        
        let finalResult = { report: "Analysis complete.", plotSpec: null };

        for (let i = 0; i < 5; i++) { // Limit to 5 rounds for now
            onProgress({ type: 'llm_start', content: `Round ${i + 1}: Thinking...` });

            const prompt = this.conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n\n');
            const systemPrompt = getSystemPrompt();
            
            const llmResponse = await aiService.callQwenAPI(prompt, systemPrompt);
            this.conversationHistory.push({ role: 'assistant', content: llmResponse });
            
            const parsedResponse = parseYaml(llmResponse);

            if (!parsedResponse || !parsedResponse.action) {
                onProgress({ type: 'error', content: 'Invalid response from LLM.' });
                break;
            }

            if (parsedResponse.action === 'generate_code') {
                onProgress({ type: 'code_start', content: 'Executing code...' });
                try {
                    const codeToExecute = parsedResponse.code;
                    const result = await this.executeInWorker(codeToExecute, data);
                    const feedback = `Code executed successfully. Output:\n${JSON.stringify(result.data, null, 2)}`;
                    this.conversationHistory.push({ role: 'user', content: feedback });
                    onProgress({ type: 'code_end', content: feedback });
                } catch (error) {
                    const feedback = `Code execution failed. Error:\n${error.message}`;
                    this.conversationHistory.push({ role: 'user', content: feedback });
                    onProgress({ type: 'error', content: feedback });
                }
            } else if (parsedResponse.action === 'generate_plot') {
                onProgress({ type: 'plot', content: 'Generating plot...' });
                finalResult.plotSpec = parsedResponse.plot_spec;
                // Assuming plotting is the final step for now
                break; 
            } else if (parsedResponse.action === 'analysis_complete') {
                onProgress({ type: 'complete', content: 'Analysis complete.' });
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
