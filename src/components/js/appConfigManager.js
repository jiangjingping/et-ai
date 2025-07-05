// src/components/js/appConfigManager.js

class AppConfigManager {
    constructor() {
        // LLM Configurations
        this.currentLlmConfig = null;
        this.llmConfigs = new Map();
        this.llmConfigsStorageKey = 'wps_ai_llm_configs';
        this.currentLlmConfigIdKey = 'wps_ai_current_llm_config_id';
        this.presetLlmConfigs = {
            'qwen-plus': {
                id: 'qwen-plus',
                name: '通义千问 Plus',
                provider: 'Alibaba',
                baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                model: 'qwen-plus',
                apiKey: import.meta.env.VITE_QWEN_API_KEY || '',
                description: '阿里云通义千问Plus模型，能力均衡，推理效果、成本和速度介于通义千问-Max和通义千问-Turbo之间，适合中等复杂任务',
                isPreset: true,
                maxTokens: 8000,
                temperature: 0.7,
                topP: 0.9
            },
            'qwen-plus-latest': {
                id: 'qwen-plus-latest',
                name: '通义千问 Plus-latest',
                provider: 'Alibaba',
                baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                model: 'qwen-plus-latest',
                apiKey: import.meta.env.VITE_QWEN_API_KEY || '',
                description: '阿里云通义千问Plus模型最新版，模型支持思考模式和非思考模式',
                isPreset: true,
                maxTokens: 16000,
                temperature: 0.7,
                topP: 0.9
            },
            'qwen-max': {
                id: 'qwen-max',
                name: '通义千问 max',
                provider: 'Alibaba',
                baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                model: 'qwen-max',
                apiKey: import.meta.env.VITE_QWEN_API_KEY || '',
                description: '阿里云通义千问max模型，适合复杂任务，能力最强',
                isPreset: true,
                maxTokens: 16000,
                temperature: 0.7,
                topP: 0.9
            },
            'qwen-max-latest': {
                id: 'qwen-max-latest',
                name: '通义千问 max-latest',
                provider: 'Alibaba',
                baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                model: 'qwen-max-latest',
                apiKey: import.meta.env.VITE_QWEN_API_KEY || '',
                description: '阿里云通义千问max模型最新版',
                isPreset: true,
                maxTokens: 8000,
                temperature: 0.7,
                topP: 0.9
            },
            'qwen2.5-72b-instruct': {
                id: 'qwen2.5-72b-instruct',
                name: '通义千问 2.5-72B',
                provider: 'Alibaba',
                baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                model: 'qwen2.5-72b-instruct',
                apiKey: import.meta.env.VITE_QWEN_API_KEY || '',
                description: '阿里云通义千问2.5版本，720亿参数的大语言模型，性能强大。',
                isPreset: true,
                maxTokens: 16000,
                temperature: 0.7,
                topP: 0.9
            },
            'gpt-4': {
                id: 'gpt-4',
                name: 'GPT-4',
                provider: 'OpenAI',
                baseURL: 'https://api.openai.com/v1',
                model: 'gpt-4',
                apiKey: '',
                description: 'OpenAI GPT-4模型，具有更强的推理能力',
                isPreset: true,
                maxTokens: 8000,
                temperature: 0.7,
                topP: 0.9
            },
            'claude-3-sonnet': {
                id: 'claude-3-sonnet',
                name: 'Claude 3 Sonnet',
                provider: 'Anthropic',
                baseURL: 'https://api.anthropic.com/v1',
                model: 'claude-3-sonnet-20240229',
                apiKey: '',
                description: 'Anthropic Claude 3 Sonnet模型',
                isPreset: true,
                maxTokens: 8000,
                temperature: 0.7,
                topP: 0.9
            }
        };

        // General Application Settings
        this.generalSettingsStorageKey = 'wps_ai_general_settings';
        this.defaultGeneralSettings = {
            app: {
                name: 'ET-AI',
                version: '1.0.0', // This could be dynamic later
                debug: false
            },
            features: {
                streamOutput: true,
                markdownRender: true,
                autoSave: true, // Example: auto-save LLM configs
                confirmDangerousOperations: true
            },
            ui: {
                theme: 'light',
                language: 'zh-CN',
                chatPanelWidth: 400,
                showDebugInfo: false
            }
        };
        this.settings = {}; // Holds merged general settings

        this.loadAllConfigs();
    }

    loadAllConfigs() {
        this.loadLlmConfigs();
        this.loadGeneralSettings();
    }

    // --- LLM Configuration Methods (adapted from LLMConfigManager) ---
    loadLlmConfigs() {
        try {
            const savedLlmConfigs = this.getFromStorage(this.llmConfigsStorageKey);
            const currentLlmConfigId = this.getFromStorage(this.currentLlmConfigIdKey);

            this.llmConfigs.clear();

            for (const [id, config] of Object.entries(this.presetLlmConfigs)) {
                this.llmConfigs.set(id, { ...config });
            }

            if (savedLlmConfigs) {
                for (const [id, config] of Object.entries(savedLlmConfigs)) {
                    this.llmConfigs.set(id, config);
                }
            }

            if (currentLlmConfigId && this.llmConfigs.has(currentLlmConfigId)) {
                this.currentLlmConfig = this.llmConfigs.get(currentLlmConfigId);
            } else {
                for (const config of this.llmConfigs.values()) {
                    if (config.apiKey) {
                        this.currentLlmConfig = config;
                        break;
                    }
                }
                if (!this.currentLlmConfig) {
                    this.currentLlmConfig = this.llmConfigs.get('qwen-plus');
                }
            }
            console.log('LLM configs loaded. Current:', this.currentLlmConfig?.name);
        } catch (error) {
            console.error('Failed to load LLM configs:', error);
            // Fallback to a preset if all else fails, ensuring currentLlmConfig is an object
            this.currentLlmConfig = JSON.parse(JSON.stringify(this.presetLlmConfigs['qwen-plus']));
        }
    }

    saveLlmConfigs() {
        try {
            const configsToSave = {};
            for (const [id, config] of this.llmConfigs.entries()) {
                if (!config.isPreset || config.apiKey || this.isLlmConfigModified(config)) {
                    configsToSave[id] = config;
                }
            }
            this.saveToStorage(this.llmConfigsStorageKey, configsToSave);
            if (this.currentLlmConfig) {
                this.saveToStorage(this.currentLlmConfigIdKey, this.currentLlmConfig.id);
            }
            console.log('LLM configs saved.');
        } catch (error) {
            console.error('Failed to save LLM configs:', error);
        }
    }

    isLlmConfigModified(config) {
        if (!config.isPreset) return true;
        const preset = this.presetLlmConfigs[config.id];
        if (!preset) return true; // Should not happen if ID is from preset
        return (
            config.baseURL !== preset.baseURL ||
            config.model !== preset.model ||
            config.maxTokens !== preset.maxTokens ||
            config.temperature !== preset.temperature ||
            config.topP !== preset.topP ||
            config.description !== preset.description
            // apiKey is intentionally not compared here for modification status of preset,
            // as user might fill it in. Saving occurs if apiKey is present.
        );
    }

    createLlmConfig(configData) {
        const newConfig = {
            id: configData.id || this.generateConfigId('llm_'),
            name: configData.name || '新LLM配置',
            provider: configData.provider || 'Custom',
            baseURL: configData.baseURL || '',
            model: configData.model || '',
            apiKey: configData.apiKey || '',
            description: configData.description || '',
            isPreset: false,
            maxTokens: configData.maxTokens === undefined ? 8000 : configData.maxTokens,
            temperature: configData.temperature === undefined ? 0.7 : configData.temperature,
            topP: configData.topP === undefined ? 0.9 : configData.topP,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.llmConfigs.set(newConfig.id, newConfig);
        this.saveLlmConfigs();
        return newConfig;
    }

    updateLlmConfig(configId, updates) {
        const config = this.llmConfigs.get(configId);
        if (!config) throw new Error(`LLM Config not found: ${configId}`);
        const updatedConfig = { ...config, ...updates, updatedAt: new Date().toISOString() };
        this.llmConfigs.set(configId, updatedConfig);
        if (this.currentLlmConfig && this.currentLlmConfig.id === configId) {
            this.currentLlmConfig = updatedConfig;
        }
        this.saveLlmConfigs();
        return updatedConfig;
    }

    deleteLlmConfig(configId) {
        const config = this.llmConfigs.get(configId);
        if (!config) throw new Error(`LLM Config not found: ${configId}`);
        if (config.isPreset) throw new Error('Cannot delete preset LLM config.');
        this.llmConfigs.delete(configId);
        if (this.currentLlmConfig && this.currentLlmConfig.id === configId) {
            this.currentLlmConfig = this.llmConfigs.get('qwen-plus') || Array.from(this.llmConfigs.values())[0];
             if (!this.currentLlmConfig && this.llmConfigs.size > 0) { // Fallback if qwen-plus was deleted (not possible for preset)
                this.currentLlmConfig = Array.from(this.llmConfigs.values())[0];
            } else if (!this.currentLlmConfig) { // If all configs are deleted
                 this.currentLlmConfig = JSON.parse(JSON.stringify(this.presetLlmConfigs['qwen-plus'])); // Fallback to a default preset
            }
        }
        this.saveLlmConfigs();
    }

    switchLlmConfig(configId) {
        const config = this.llmConfigs.get(configId);
        if (!config) throw new Error(`LLM Config not found: ${configId}`);
        this.currentLlmConfig = config;
        this.saveLlmConfigs(); // Save current selection
        console.log('Switched to LLM config:', config.name);
        return config;
    }

    getCurrentLlmConfig() {
        // Ensure currentLlmConfig is always an object, even if loading fails or no suitable config is found
        if (!this.currentLlmConfig || Object.keys(this.currentLlmConfig).length === 0) {
            this.loadLlmConfigs(); // Attempt to reload or set a default
            if (!this.currentLlmConfig || Object.keys(this.currentLlmConfig).length === 0) {
                 // If still no valid config, return a copy of a default preset to avoid errors downstream
                return JSON.parse(JSON.stringify(this.presetLlmConfigs['qwen-plus']));
            }
        }
        return this.currentLlmConfig;
    }

    getAllLlmConfigs() {
        return Array.from(this.llmConfigs.values());
    }

    getLlmConfig(configId) {
        return this.llmConfigs.get(configId);
    }

    validateLlmConfig(config) { // Renamed from validateConfig
        const errors = [];
        if (!config.name?.trim()) errors.push('LLM配置名称不能为空');
        if (!config.baseURL?.trim()) errors.push('LLM Base URL不能为空');
        if (!config.model?.trim()) errors.push('LLM模型名称不能为空');
        if (!config.apiKey?.trim()) errors.push('LLM API Key不能为空');
        if (config.maxTokens !== undefined && (isNaN(parseInt(config.maxTokens)) || parseInt(config.maxTokens) < 1 || parseInt(config.maxTokens) > 100000)) errors.push('LLM最大Token数应为1-100000之间的数字');
        if (config.temperature !== undefined && (isNaN(parseFloat(config.temperature)) || parseFloat(config.temperature) < 0 || parseFloat(config.temperature) > 2)) errors.push('LLM Temperature应为0-2之间的数字');
        if (config.topP !== undefined && (isNaN(parseFloat(config.topP)) || parseFloat(config.topP) < 0 || parseFloat(config.topP) > 1)) errors.push('LLM Top P应为0-1之间的数字');
        return errors;
    }

    async testLlmConfig(config) { // Renamed from testConfig
        try {
            const testMessages = [{ role: 'user', content: '你好，请回复"连接测试成功"' }];
            const response = await fetch(`${config.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: testMessages,
                    max_tokens: 50,
                    temperature: 0.1
                })
            });
            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`API调用失败: ${response.status} - ${errorData}`);
            }
            const data = await response.json();
            if (data.choices?.[0]?.message) {
                return { success: true, message: 'LLM连接测试成功', response: data.choices[0].message.content };
            } else {
                throw new Error('LLM API响应格式错误');
            }
        } catch (error) {
            return { success: false, message: `LLM连接测试失败: ${error.message}`, error: error };
        }
    }
    
    exportLlmConfigs() { // Renamed from exportConfigs
        const configs = {};
        for (const [id, config] of this.llmConfigs.entries()) {
            if (!config.isPreset || this.isLlmConfigModified(config) || config.apiKey) { // Also export presets if API key is filled
                configs[id] = { ...config, apiKey: config.apiKey ? '***' : '' };
            }
        }
        return { version: '1.0', exportTime: new Date().toISOString(), llmConfigs: configs };
    }

    importLlmConfigs(importData) { // Renamed from importConfigs
        try {
            if (!importData.llmConfigs) throw new Error('导入数据格式错误 (缺少 llmConfigs)');
            let importCount = 0;
            for (const [id, config] of Object.entries(importData.llmConfigs)) {
                const newId = this.generateConfigId('llm_');
                // Retain imported apiKey if it's not '***', otherwise clear it
                const importedApiKey = (config.apiKey && config.apiKey !== '***') ? config.apiKey : '';
                const newConfig = { ...config, id: newId, apiKey: importedApiKey, importedAt: new Date().toISOString(), isPreset: false };
                this.llmConfigs.set(newId, newConfig);
                importCount++;
            }
            this.saveLlmConfigs();
            return { success: true, importCount };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // --- General Application Settings Methods (from ConfigManager) ---
    loadGeneralSettings() {
        try {
            const savedSettings = this.getFromStorage(this.generalSettingsStorageKey);
            if (savedSettings) {
                this.settings = this.mergeDeep(JSON.parse(JSON.stringify(this.defaultGeneralSettings)), savedSettings);
            } else {
                this.settings = JSON.parse(JSON.stringify(this.defaultGeneralSettings));
            }
            console.log('General settings loaded.');
        } catch (error) {
            console.warn('Failed to load general settings, using defaults:', error);
            this.settings = JSON.parse(JSON.stringify(this.defaultGeneralSettings));
        }
    }

    saveGeneralSettings() {
        try {
            this.saveToStorage(this.generalSettingsStorageKey, this.settings);
            console.log('General settings saved.');
            return true;
        } catch (error) {
            console.error('Failed to save general settings:', error);
            return false;
        }
    }

    getSetting(path, defaultValue = null) {
        try {
            const keys = path.split('.');
            let value = this.settings;
            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    return defaultValue;
                }
            }
            return value;
        } catch (error) {
            console.warn(`Failed to get setting: ${path}`, error);
            return defaultValue;
        }
    }

    setSetting(path, value) {
        try {
            const keys = path.split('.');
            let current = this.settings;
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!current[key] || typeof current[key] !== 'object') {
                    current[key] = {};
                }
                current = current[key];
            }
            current[keys[keys.length - 1]] = value;
            this.saveGeneralSettings();
            return true;
        } catch (error) {
            console.error(`Failed to set setting: ${path}`, error);
            return false;
        }
    }
    
    isDevelopment() {
        return this.getSetting('app.debug') ||
               (typeof window !== 'undefined' && (
                   window.location.hostname === 'localhost' ||
                   window.location.hostname === '127.0.0.1' ||
                   window.location.protocol === 'file:'
               ));
    }

    resetGeneralSettings() {
        this.settings = JSON.parse(JSON.stringify(this.defaultGeneralSettings));
        this.saveGeneralSettings();
    }

    exportGeneralSettings() {
        return { ...this.settings };
    }

    importGeneralSettings(settingsData) {
        try {
            // Ensure defaultGeneralSettings is used as a base for mergeDeep
            this.settings = this.mergeDeep(JSON.parse(JSON.stringify(this.defaultGeneralSettings)), settingsData);
            this.saveGeneralSettings();
            return true;
        } catch (error) {
            console.error('Failed to import general settings:', error);
            return false;
        }
    }


    // --- Common Utility Methods ---
    generateConfigId(prefix = 'cfg_') {
        return prefix + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    saveToStorage(key, data) {
        try {
            if (typeof window !== 'undefined' && window.Application && window.Application.PluginStorage) {
                window.Application.PluginStorage.setItem(key, JSON.stringify(data));
            } else if (typeof localStorage !== 'undefined') {
                localStorage.setItem(key, JSON.stringify(data));
            }
        } catch (error) {
            console.error('Failed to save to storage:', error);
        }
    }

    getFromStorage(key) {
        try {
            let data;
            if (typeof window !== 'undefined' && window.Application && window.Application.PluginStorage) {
                data = window.Application.PluginStorage.getItem(key);
            } else if (typeof localStorage !== 'undefined') {
                data = localStorage.getItem(key);
            }
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Failed to read from storage:', error);
            return null;
        }
    }

    isObject(item) {
        return (item && typeof item === 'object' && !Array.isArray(item));
    }

    mergeDeep(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();
        const output = { ...target };

        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!target[key]) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this.mergeDeep(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        return this.mergeDeep(output, ...sources);
    }
}

// Create global instance
const appConfigManager = new AppConfigManager();

export default appConfigManager;
