import { CodeExecutor } from './CodeExecutor.js';
import { dataAnalysisSystemPrompt, finalReportSystemPrompt } from '../prompts/system_prompts.js';
import { llmConfig } from '../config/llmConfig.js';
import { callLLMApi } from '../utils/llmHelper.js';

// A simple YAML parser (in a real scenario, a robust library is better)
function parseYaml(yamlStr) {
    const lines = yamlStr.split('\n');
    const result = {};
    let currentKey = '';
    let isMultiLine = false;

    for (const line of lines) {
        if (line.trim().startsWith('```')) continue;

        if (isMultiLine) {
            if (line.startsWith('  ') || line.trim() === '') {
                result[currentKey] += line.substring(2) + '\n';
            } else {
                isMultiLine = false;
            }
        }

        const match = line.match(/^(\w+):\s*("?)(.*)\2$/);
        if (match && !isMultiLine) {
            const key = match[1];
            let value = match[3];
            if (value === '|') {
                isMultiLine = true;
                currentKey = key;
                result[key] = '';
            } else {
                result[key] = value;
            }
        }
    }
    return result;
}


export class DataAnalysisAgent {
    constructor() {
        this.llmConfig = llmConfig;
        this.maxRounds = 20;
        this.executor = new CodeExecutor();
        this.reset();
    }

    reset() {
        this.conversationHistory = [];
        this.analysisResults = [];
        this.currentRound = 0;
    }

    async _callLLM(messages) {
        try {
            return await callLLMApi(messages);
        } catch (error) {
            console.error("LLM call failed:", error);
            // Return a structured error response that the agent can process
            return `
action: "error"
error: "LLM API call failed: ${error.message}"
`;
        }
    }

    _processResponse(response) {
        try {
            const yamlData = parseYaml(response);
            const action = yamlData.action || 'generate_code';
            console.log(`🎯 Detected action: ${action}`);
            return { action, data: yamlData };
        } catch (e) {
            console.error("YAML parsing failed:", e);
            return { action: 'error', error: 'Failed to parse LLM response' };
        }
    }

    async analyze(userInput, data) {
        this.reset();
        await this.executor.loadData(data);

        const initialPrompt = `User Query: ${userInput}\n\nPlease start the analysis. First, explore the data.`;
        this.conversationHistory.push({ role: 'user', content: initialPrompt });

        while (this.currentRound < this.maxRounds) {
            this.currentRound++;
            console.log(`\n🔄 Round ${this.currentRound}`);

            const envInfo = await this.executor.getEnvironmentInfo();
            const systemPrompt = dataAnalysisSystemPrompt.replace('{notebook_variables}', envInfo);
            
            const messages = [
                { role: 'system', content: systemPrompt },
                ...this.conversationHistory
            ];

            const llmResponse = await this._callLLM(messages);
            this.conversationHistory.push({ role: 'assistant', content: llmResponse });

            const processed = this._processResponse(llmResponse);

            if (processed.action === 'generate_code') {
                try {
                    const code = processed.data.code;
                    const result = await this.executor.executeCode(code);
                    const feedback = `Execution successful. Result: ${JSON.stringify(result, null, 2)}`;
                    this.conversationHistory.push({ role: 'user', content: `Code execution feedback:\n${feedback}` });
                    this.analysisResults.push({ round: this.currentRound, code, result });
                } catch (error) {
                    const feedback = `Execution failed. Error: ${error.message}`;
                    this.conversationHistory.push({ role: 'user', content: `Code execution feedback:\n${feedback}` });
                }
            } else if (processed.action === 'analysis_complete') {
                console.log('✅ Analysis complete!');
                return {
                    final_report: processed.data.final_report,
                    results: this.analysisResults
                };
            } else if (processed.action === 'error') {
                console.error('Agent error:', processed.error);
                break;
            }
        }

        console.log(`⚠️ Reached max rounds (${this.maxRounds}).`);
        // In a real scenario, generate a final report here as well.
        return {
            final_report: "Analysis stopped due to reaching maximum rounds.",
            results: this.analysisResults
        };
    }

    terminate() {
        this.executor.terminate();
    }
}
