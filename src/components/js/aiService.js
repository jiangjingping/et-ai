import axios from 'axios'
import appConfigManager from './appConfigManager.js'

const PY_BACKEND_URL = 'http://127.0.0.1:8000/analyze';

// --- 原有函数 ---

const DEFAULT_FALLBACK_PARAMS = {
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-plus',
    maxTokens: 8000,
    temperature: 0.7,
    topP: 0.9
}

let currentAbortController = null
let currentReader = null

function stop() {
    console.log('停止AI服务请求')
    if (currentAbortController) {
        currentAbortController.abort()
        currentAbortController = null
    }
    if (currentReader) {
        try {
            currentReader.releaseLock()
        } catch (error) {
            console.warn('释放reader失败:', error)
        }
        currentReader = null
    }
}

function getCurrentLLMConfigInternal() {
    const activeLlmConfig = appConfigManager.getCurrentLlmConfig();
    if (!activeLlmConfig || !activeLlmConfig.apiKey) {
        console.error('No active LLM configuration with API Key found in appConfigManager.');
        return { 
            ...DEFAULT_FALLBACK_PARAMS, 
            apiKey: null
        };
    }
    let baseURL = activeLlmConfig.baseURL;
    if (baseURL && !baseURL.includes('/chat/completions')) {
        baseURL = baseURL.endsWith('/') ? `${baseURL}chat/completions` : `${baseURL}/chat/completions`;
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

async function callQwenAPI(prompt, systemPrompt = '', options = { jsonMode: false }) {
    const llmConfig = getCurrentLLMConfigInternal();
    if (!llmConfig.apiKey) {
        throw new Error('请先在LLM配置中设置有效的API Key');
    }
    const messages = [];
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    const requestBody = {
        model: llmConfig.model,
        messages: messages,
        temperature: llmConfig.temperature,
        max_tokens: llmConfig.maxTokens,
        top_p: llmConfig.topP,
        stream: false
    };
    if (options.jsonMode) {
        requestBody.response_format = { type: "json_object" };
    }
    try {
        const response = await axios.post(llmConfig.baseURL, requestBody, {
            headers: {
                'Authorization': `Bearer ${llmConfig.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        const message = response.data?.choices?.[0]?.message;
        if (message) {
            return options.jsonMode ? message : message.content;
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

async function callQwenAPIStream(prompt, systemPrompt = '', options = { jsonMode: false }, onChunk = null, onComplete = null, onError = null) {
    const llmConfig = getCurrentLLMConfigInternal();
    if (!llmConfig.apiKey) {
        const error = new Error('请先在LLM配置中设置有效的API Key');
        if (onError) onError(error);
        throw error;
    }
    const messages = [];
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    
    const requestBody = {
        model: llmConfig.model,
        messages: messages,
        stream: true,
        temperature: llmConfig.temperature,
        top_p: llmConfig.topP,
    };

    if (options.jsonMode) {
        requestBody.response_format = { type: "json_object" };
    }

    try {
        currentAbortController = new AbortController();
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

        while (true) {
            if (currentAbortController?.signal.aborted) {
                console.log('流式请求被用户中止');
                if (onError) onError(new Error('用户中止请求'));
                break;
            }

            const { done, value } = await currentReader.read();
            if (done) {
                const finalResult = options.jsonMode ? JSON.parse(accumulatedContent) : accumulatedContent;
                if (onComplete) onComplete(finalResult);
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const jsonStr = line.substring(6);
                        if (jsonStr === '[DONE]') continue;
                        const data = JSON.parse(jsonStr);
                        const delta = data.choices?.[0]?.delta?.content || '';
                        if (delta) {
                            accumulatedContent += delta;
                            if (onChunk) {
                                const partialJson = options.jsonMode ? JSON.parse(accumulatedContent) : null;
                                onChunk(options.jsonMode ? partialJson : delta, accumulatedContent);
                            }
                        }
                    } catch (e) {
                        // Ignore parsing errors for partial JSON
                    }
                }
            }
        }
    } catch (error) {
        console.error('流式API调用失败:', error);
        if (onError && error.name !== 'AbortError') {
            onError(error);
        }
        if (error.name !== 'AbortError') {
            throw error;
        }
    } finally {
        // ... (finally block remains the same)
    }
}

// --- 新增函数 ---

/**
 * 调用Python后端分析服务，并以流式方式处理响应。
 * @param {string} userInput - 用户的自然语言输入。
 * @param {string} csvData - CSV格式的表格数据。
 * @param {object} callbacks - 包含 onChunk, onComplete, onError 的回调对象。
 */
async function callPyBackendServiceStream(userInput, csvData, callbacks = {}) {
    const { onChunk, onComplete, onError } = callbacks;
    
    try {
        const response = await fetch(PY_BACKEND_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_input: userInput,
                csv_data: csvData,
            }),
        });

        if (!response.ok) {
            throw new Error(`后端服务错误: ${response.status} ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                if (onComplete) onComplete();
                break;
            }
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const jsonStr = line.slice(6);
                        const data = JSON.parse(jsonStr);
                        if (onChunk) onChunk(data);
                    } catch (e) {
                        console.warn('解析后端流式JSON失败:', e, '原始行:', line);
                    }
                }
            }
        }
    } catch (error) {
        console.error('调用Python后端服务失败:', error);
        if (onError) onError(error);
    }
}

export default {
    callQwenAPI,
    callQwenAPIStream,
    callPyBackendServiceStream,
    stop
};
