/**
 * 工具注册系统
 * 管理所有可用的分析工具
 */
export class ToolRegistry {
    constructor() {
        this.tools = new Map();
        this.initialized = false;
    }

    /**
     * 注册工具
     * @param {string} name - 工具名称
     * @param {Object} tool - 工具实例
     */
    register(name, tool) {
        if (!name || !tool) {
            throw new Error('Tool name and instance are required');
        }
        
        if (!tool.execute || typeof tool.execute !== 'function') {
            throw new Error('Tool must have an execute method');
        }

        this.tools.set(name, tool);
        console.log(`Tool registered: ${name}`);
    }

    /**
     * 获取工具
     * @param {string} name - 工具名称
     * @returns {Object|null} 工具实例
     */
    getTool(name) {
        return this.tools.get(name) || null;
    }

    /**
     * 获取所有工具名称
     * @returns {Array<string>} 工具名称列表
     */
    getToolNames() {
        return Array.from(this.tools.keys());
    }

    /**
     * 获取工具描述信息
     * @returns {Array<Object>} 工具描述列表
     */
    getToolDescriptions() {
        const descriptions = [];
        for (const [name, tool] of this.tools) {
            descriptions.push({
                name: name,
                description: tool.description || 'No description available',
                capabilities: tool.capabilities || [],
                inputTypes: tool.inputTypes || ['text']
            });
        }
        return descriptions;
    }

    /**
     * 检查工具是否存在
     * @param {string} name - 工具名称
     * @returns {boolean} 是否存在
     */
    hasTool(name) {
        return this.tools.has(name);
    }

    /**
     * 移除工具
     * @param {string} name - 工具名称
     * @returns {boolean} 是否成功移除
     */
    unregister(name) {
        const result = this.tools.delete(name);
        if (result) {
            console.log(`Tool unregistered: ${name}`);
        }
        return result;
    }

    /**
     * 清空所有工具
     */
    clear() {
        this.tools.clear();
        console.log('All tools cleared');
    }

    /**
     * 获取工具统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            totalTools: this.tools.size,
            toolNames: this.getToolNames(),
            initialized: this.initialized
        };
    }

    /**
     * 初始化注册系统
     */
    async initialize() {
        this.initialized = true;
        console.log('Tool registry initialized');
    }
}

// 创建全局工具注册实例
export const toolRegistry = new ToolRegistry();
