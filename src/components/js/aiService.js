import axios from 'axios'
import appConfigManager from './appConfigManager.js'
import { executeDanfoCode } from './dataTool.js';


// 默认配置（不包含敏感信息）
// This DEFAULT_CONFIG is mainly for baseURL and model if no config is somehow found,
// but apiKey must come from appConfigManager.
const DEFAULT_FALLBACK_PARAMS = {
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-plus',
    maxTokens: 8000,
    temperature: 0.7,
    topP: 0.9
}

// 全局状态管理
let currentAbortController = null
let currentReader = null

// 停止当前AI请求
function stop() {
    console.log('停止AI服务请求')

    // 停止流式请求
    if (currentAbortController) {
        currentAbortController.abort()
        currentAbortController = null
    }

    // 释放reader
    if (currentReader) {
        try {
            currentReader.releaseLock()
        } catch (error) {
            console.warn('释放reader失败:', error)
        }
        currentReader = null
    }
}

// 获取当前LLM配置
function getCurrentLLMConfigInternal() { // Renamed to avoid conflict if exported directly
    const activeLlmConfig = appConfigManager.getCurrentLlmConfig();

    if (!activeLlmConfig || !activeLlmConfig.apiKey) {
        // This case should be rare as appConfigManager.getCurrentLlmConfig() has fallbacks.
        // However, if it happens, or if apiKey is missing, we can't proceed.
        // Throw an error or return a config that will fail the apiKey check later.
        console.error('No active LLM configuration with API Key found in appConfigManager.');
        return { 
            ...DEFAULT_FALLBACK_PARAMS, 
            apiKey: null // Explicitly null to ensure API calls fail if this state is reached
        };
    }

    // Ensure baseURL is correctly formatted
    let baseURL = activeLlmConfig.baseURL;
    if (baseURL && !baseURL.includes('/chat/completions')) {
        baseURL = baseURL.endsWith('/') ?
            `${baseURL}chat/completions` :
            `${baseURL}/chat/completions`;
    }

    return {
        baseURL: baseURL,
        model: activeLlmConfig.model,
        apiKey: activeLlmConfig.apiKey,
        maxTokens: activeLlmConfig.maxTokens === undefined ? DEFAULT_FALLBACK_PARAMS.maxTokens : activeLlmConfig.maxTokens,
        temperature: activeLlmConfig.temperature === undefined ? DEFAULT_FALLBACK_PARAMS.temperature : activeLlmConfig.temperature,
        topP: activeLlmConfig.topP === undefined ? DEFAULT_FALLBACK_PARAMS.topP : activeLlmConfig.topP,
    };
}

// 调用LLM API (非流式)
// 使用OpenAI兼容格式，支持更好的消息结构和参数控制
async function callQwenAPI(prompt, systemPrompt = '') {
    const llmConfig = getCurrentLLMConfigInternal();

    if (!llmConfig.apiKey) {
        throw new Error('请先在LLM配置中设置有效的API Key');
    }

    const messages = [];
    if (systemPrompt) {
        messages.push({
            role: 'system',
            content: systemPrompt
        });
    }
    messages.push({
        role: 'user',
        content: prompt
    });

    try {
        const response = await axios.post(llmConfig.baseURL, {
            model: llmConfig.model,
            messages: messages,
            temperature: llmConfig.temperature,
            max_tokens: llmConfig.maxTokens,
            top_p: llmConfig.topP,
            stream: false
        }, {
            headers: {
                'Authorization': `Bearer ${llmConfig.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data?.choices?.[0]?.message) {
            return response.data.choices[0].message.content;
        } else {
            throw new Error('API响应格式错误或无有效内容');
        }
    } catch (error) {
        console.error('调用LLM API失败:', error);
        if (error.response) {
            throw new Error(`API调用失败: ${error.response.status} - ${error.response.data?.error?.message || error.response.data?.message || '未知API错误'}`);
        } else if (error.request) {
            throw new Error('网络请求失败，请检查网络连接');
        } else {
            throw new Error(`请求配置错误: ${error.message}`);
        }
    }
}

// 将原始数据转换为Markdown格式的辅助函数
function formatRawDataToMarkdown(data) {
    if (!data || !Array.isArray(data) || data.length === 0) {
        return '';
    }
    const header = data[0].map(cell => String(cell === null || cell === undefined ? '' : cell).replace(/\|/g, '\\|'));
    const separator = header.map(() => '---');
    const body = data.slice(1).map(row =>
        row.map(cell => String(cell === null || cell === undefined ? '' : cell).replace(/\|/g, '\\|'))
    );
    let markdownTable = `| ${header.join(' | ')} |\n`;
    markdownTable += `| ${separator.join(' | ')} |\n`;
    body.forEach(row => {
        const fullRow = [];
        for (let i = 0; i < header.length; i++) {
            fullRow.push(row[i] !== undefined ? row[i] : '');
        }
        markdownTable += `| ${fullRow.join(' | ')} |\n`;
    });
    return markdownTable;
}


// 调用LLM API (流式输出)
// 支持实时流式响应，适用于对话场景
async function handleNormalPrompt(prompt, rawData, onChunk, onComplete, onError) {
    // 提取表头用于决策
    const headers = (rawData && rawData.length > 0) ? rawData[0] : [];
    const systemPromptForDanfoCheck = `
        你是一个决策引擎。你的任务是判断用户的问题是否需要使用Danfo.js进行数据分析或处理。
        Danfo.js是一个用于数据处理和分析的JavaScript库，类似于Python中的Pandas。
        如果问题涉及对表格数据的计算、转换、聚合、排序、过滤或生成图表所需的数据格式，请回答"YES"。
        如果问题只是简单的问答、文本生成或与表格数据无关，请回答"NO"。
        你的回答只能是"YES"或"NO"。

        用户问题: "${prompt}"
        表格表头: [${headers.join(', ')}]
    `;

    try {
        const useDanfoResponse = await callQwenAPI(systemPromptForDanfoCheck, '');
        console.log('Danfo.js check response:', useDanfoResponse);

        if (useDanfoResponse.trim().toUpperCase().includes('YES')) {
            console.log('需要使用Danfo.js进行处理');
            const systemPromptForDanfoCode = `
                你是一个Danfo.js代码生成器。根据用户的问题和数据，生成一段Danfo.js代码来解决问题。
                你可以使用 'df' (DataFrame对象) 和 'dfd' (Danfo.js库) 两个变量。
                代码应该返回一个处理后的DataFrame、Series，或者一个用于生成图表的JSON对象。
                重要提示：当使用 groupby 后跟聚合函数（如 .mean(), .sum()）时，请明确选择要聚合的数值列。例如，使用 df.groupby('分类列')[['数值列1', '数值列2']].mean() 而不是 df.groupby('分类列').mean()。
                不要包含任何解释或注释，只返回纯代码。

                用户问题: "${prompt}"
                数据的前5行: ${JSON.stringify(rawData.slice(0, 5))}
            `;
            const danfoCode = await callQwenAPI(systemPromptForDanfoCode, '');
            console.log('--- GENERATED DANFO.JS CODE START ---');
            console.log(danfoCode);
            console.log('--- GENERATED DANFO.JS CODE END ---');

            try {
                const danfoResult = await executeDanfoCode(danfoCode, rawData);
                console.log('Danfo.js execution result:', danfoResult);

                const finalPrompt = `
                    你是一个数据分析师。你已经使用Danfo.js对数据进行了预处理。
                    这是用户的原始问题: "${prompt}"
                    这是Danfo.js的处理结果: ${JSON.stringify(danfoResult)}
                    请根据这些信息，生成最终的、面向用户的自然语言回答。如果结果适合可视化，请提供ECharts的配置。
                `;
                await callQwenAPIStream(finalPrompt, '', onChunk, onComplete, onError);

            } catch (danfoError) {
                console.error('Danfo.js处理失败，回退到常规流程:', danfoError);
                const fallbackPrompt = `请参考以下表格数据：\n${formatRawDataToMarkdown(rawData)}\n\n针对以上数据，我的问题是：\n${prompt}`;
                await callQwenAPIStream(fallbackPrompt, '你是一个数据分析助手。', onChunk, onComplete, onError);
            }
        } else {
            console.log('不需要使用Danfo.js，进入常规流程');
            const fallbackPrompt = `请参考以下表格数据：\n${formatRawDataToMarkdown(rawData)}\n\n针对以上数据，我的问题是：\n${prompt}`;
            await callQwenAPIStream(fallbackPrompt, '你是一个数据分析助手。', onChunk, onComplete, onError);
        }
    } catch (error) {
        console.error('处理请求时发生错误:', error);
        if (onError) {
            onError(error);
        }
    }
}

async function callQwenAPIStream(prompt, systemPrompt = '', onChunk = null, onComplete = null, onError = null) {
    const llmConfig = getCurrentLLMConfigInternal();

    if (!llmConfig.apiKey) {
        const error = new Error('请先在LLM配置中设置有效的API Key');
        if (onError) onError(error);
        throw error;
    }

    const messages = [];
    if (systemPrompt) {
        messages.push({
            role: 'system',
            content: systemPrompt
        });
    }
    messages.push({
        role: 'user',
        content: prompt
    });

    try {
        currentAbortController = new AbortController();

        const requestBody = {
            model: llmConfig.model,
            messages: messages,
            stream: true
        };

        if (llmConfig.temperature !== undefined && llmConfig.temperature >= 0 && llmConfig.temperature <= 2) {
            requestBody.temperature = llmConfig.temperature;
        }
        if (llmConfig.topP !== undefined && llmConfig.topP > 0 && llmConfig.topP <= 1) {
            requestBody.top_p = llmConfig.topP;
        }
        // max_tokens is often problematic with streaming APIs or not supported for some models in stream mode.
        // If needed, it can be added here, but ensure compatibility.
        // if (llmConfig.maxTokens !== undefined && llmConfig.maxTokens > 0) {
        //     requestBody.max_tokens = llmConfig.maxTokens;
        // }

        const response = await fetch(llmConfig.baseURL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${llmConfig.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: currentAbortController.signal
        });

        if (!response.ok) {
            const errorDataText = await response.text();
            let errorMessage = `API调用失败: ${response.status}`;
            try {
                const errorJson = JSON.parse(errorDataText);
                errorMessage += ` - ${errorJson.error?.message || errorJson.message || errorDataText}`;
            } catch (e) {
                errorMessage += ` - ${errorDataText}`;
            }
            throw new Error(errorMessage);
        }

        currentReader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';

        try {
            while (true) {
                if (currentAbortController && currentAbortController.signal.aborted) {
                    console.log('流式请求被用户中止');
                    if (onError) onError(new Error('用户中止请求')); // Notify onError about user abort
                    break; 
                }

                const { done, value } = await currentReader.read();

                if (done) {
                    if (onComplete) onComplete(accumulatedContent);
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;

                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.slice(6);
                            const data = JSON.parse(jsonStr);

                            if (data.choices?.[0]?.delta?.content) {
                                const deltaContent = data.choices[0].delta.content;
                                accumulatedContent += deltaContent;
                                if (onChunk) onChunk(deltaContent, accumulatedContent);
                            }
                        } catch (parseError) {
                            console.warn('解析流式数据块失败:', parseError, '原始行:', line);
                        }
                    }
                }
            }
        } finally {
            if (currentReader) {
                try {
                    // Ensure reader is released even if loop breaks due to abort
                    if (!currentReader.closed) { // Check if reader is not already closed
                         await currentReader.cancel(); // Cancel the reader if aborted
                    }
                    currentReader.releaseLock();
                } catch (releaseError) {
                    console.warn('释放reader锁失败:', releaseError);
                }
                currentReader = null;
            }
            // Only nullify controller if it wasn't aborted by an external stop() call
            // If stop() was called, it already nullified currentAbortController
            if (currentAbortController && !currentAbortController.signal.aborted) {
                 currentAbortController = null;
            }
        }
        return accumulatedContent;
    } catch (error) {
        console.error('流式API调用失败:', error);
        if (onError && error.name !== 'AbortError') { // Don't call onError again if already handled by abort
             onError(error);
        }
        // Re-throw the error if it's not an AbortError, or let it be handled by the caller
        if (error.name !== 'AbortError') {
            if (error.message.includes('fetch')) { // Basic network error check
                 throw new Error('网络请求失败，请检查网络连接');
            }
            throw error; // Re-throw other errors
        }
        return accumulatedContent; // Return whatever was accumulated before abort
    }
}

export default {
    handleNormalPrompt,
    callQwenAPI,
    callQwenAPIStream,
    stop
};
