import axios from 'axios'
import appConfigManager from './appConfigManager.js'

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
async function callQwenAPI(prompt, systemPrompt = '', options = { jsonMode: false }) {
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
            // 如果是JSON模式，内容本身就是JSON字符串，直接返回消息对象
            // 否则，只返回内容字符串
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

// 调用LLM API (流式输出)
// 支持实时流式响应，适用于对话场景
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
    // getCurrentLLMConfig is internal, no need to export if not used elsewhere
    callQwenAPI,
    callQwenAPIStream,
    stop
};
