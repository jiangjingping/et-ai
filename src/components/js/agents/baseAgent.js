/**
 * 基础 Agent 类
 * 定义所有 Agent 的通用接口和行为
 */
export class BaseAgent {
    constructor(name, description) {
        this.name = name;
        this.description = description;
        this.isInitialized = false;
    }

    /**
     * 初始化 Agent
     */
    async initialize() {
        this.isInitialized = true;
        console.log(`Agent ${this.name} initialized`);
    }

    /**
     * 处理用户请求 - 子类必须实现
     * @param {string} userInput - 用户输入
     * @param {Array} tableData - 表格数据（可选）
     * @param {Object} context - 上下文信息
     * @returns {Promise<Object>} 处理结果
     */
    async process(userInput, tableData = null, context = {}) {
        throw new Error('process method must be implemented by subclass');
    }

    /**
     * 验证输入参数
     * @param {string} userInput - 用户输入
     * @returns {boolean} 是否有效
     */
    validateInput(userInput) {
        return typeof userInput === 'string' && userInput.trim().length > 0;
    }

    /**
     * 格式化响应结果
     * @param {Object} result - 原始结果
     * @returns {Object} 格式化后的结果
     */
    formatResponse(result) {
        return {
            agent: this.name,
            timestamp: new Date().toISOString(),
            success: true,
            data: result
        };
    }

    /**
     * 处理错误
     * @param {Error} error - 错误对象
     * @returns {Object} 错误响应
     */
    handleError(error) {
        console.error(`Agent ${this.name} error:`, error);
        return {
            agent: this.name,
            timestamp: new Date().toISOString(),
            success: false,
            error: error.message || 'Unknown error occurred'
        };
    }
}
