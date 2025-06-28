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

// 停止当前AI请求
function stop() {
    console.log('停止AI服务请求')

    // 停止流式请求
    if (currentAbortController) {
        currentAbortController.abort()
        currentAbortController = null
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

// 调用LLM API (流式输出)
// 支持实时流式响应，适用于对话场景
async function callQwenAPIStream(prompt, systemPrompt = '', onChunk = null, onComplete = null, onError = null) {
    const llmConfig = getCurrentLLMConfigInternal();

    if (!llmConfig.apiKey) {
        const error = new Error('请先在LLM配置中设置有效的API Key');
        if (onError) onError(error);
        // throw error; // No need to throw, onError handles it.
        return;
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
        // Add other parameters from llmConfig if they exist
        ...(llmConfig.temperature !== undefined && { temperature: llmConfig.temperature }),
        ...(llmConfig.topP !== undefined && { top_p: llmConfig.topP }),
        ...(llmConfig.maxTokens !== undefined && { max_tokens: llmConfig.maxTokens }),
    };

    const xhr = new XMLHttpRequest();
    // Assign the xhr to the global controller so it can be aborted.
    currentAbortController = xhr; 

    xhr.open('POST', llmConfig.baseURL, true);
    xhr.setRequestHeader('Authorization', `Bearer ${llmConfig.apiKey}`);
    xhr.setRequestHeader('Content-Type', 'application/json');

    let lastResponseLength = 0;
    let accumulatedContent = '';

    xhr.onprogress = function() {
        const newResponseText = xhr.responseText.substring(lastResponseLength);
        lastResponseLength = xhr.responseText.length;
        const lines = newResponseText.split('\n');

        for (const line of lines) {
            if (line.trim() === '' || !line.startsWith('data: ')) continue;
            if (line.trim() === 'data: [DONE]') continue;

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
    };

    xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
            if (onComplete) onComplete(accumulatedContent);
        } else {
            const error = new Error(`API调用失败: ${xhr.status} - ${xhr.statusText || '未知API错误'}. 响应: ${xhr.responseText}`);
            if (onError) onError(error);
        }
        currentAbortController = null;
    };

    xhr.onerror = function() {
        const error = new Error('网络请求失败，请检查网络连接');
        if (onError) onError(error);
        currentAbortController = null;
    };
    
    xhr.onabort = function() {
        console.log('XHR请求被中止');
        if (onError) onError(new Error('用户中止请求'));
        currentAbortController = null;
    };

    xhr.send(JSON.stringify(requestBody));

    // Since this is now XHR, the async/await structure is handled by callbacks.
    // The function doesn't need to return a promise of the accumulated content anymore.
}

export default {
    // getCurrentLLMConfig is internal, no need to export if not used elsewhere
    callQwenAPI,
    callQwenAPIStream,
    stop
};
