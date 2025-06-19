/**
 * 基础工具类
 * 定义所有工具的通用接口和行为
 */
export class BaseTool {
    constructor(name, description, capabilities = [], inputTypes = ['text']) {
        this.name = name;
        this.description = description;
        this.capabilities = capabilities;
        this.inputTypes = inputTypes;
        this.isInitialized = false;
    }

    /**
     * 初始化工具
     */
    async initialize() {
        this.isInitialized = true;
        console.log(`Tool ${this.name} initialized`);
    }

    /**
     * 执行工具 - 子类必须实现
     * @param {string} userInput - 用户输入
     * @param {Array} tableData - 表格数据（可选）
     * @param {Object} context - 上下文信息
     * @returns {Promise<Object>} 执行结果
     */
    async execute(userInput, tableData = null, context = {}) {
        throw new Error('execute method must be implemented by subclass');
    }

    /**
     * 验证输入参数
     * @param {string} userInput - 用户输入
     * @param {Array} tableData - 表格数据
     * @returns {boolean} 是否有效
     */
    validateInput(userInput, tableData = null) {
        if (!userInput || typeof userInput !== 'string' || userInput.trim().length === 0) {
            return false;
        }
        return true;
    }

    /**
     * 格式化工具响应
     * @param {Object} result - 原始结果
     * @param {string} type - 结果类型
     * @returns {Object} 格式化后的结果
     */
    formatResponse(result, type = 'text') {
        return {
            tool: this.name,
            type: type,
            timestamp: new Date().toISOString(),
            success: true,
            data: result
        };
    }

    /**
     * 处理工具错误
     * @param {Error} error - 错误对象
     * @returns {Object} 错误响应
     */
    handleError(error) {
        console.error(`Tool ${this.name} error:`, error);
        return {
            tool: this.name,
            type: 'error',
            timestamp: new Date().toISOString(),
            success: false,
            error: error.message || 'Unknown error occurred'
        };
    }

    /**
     * 获取工具信息
     * @returns {Object} 工具信息
     */
    getInfo() {
        return {
            name: this.name,
            description: this.description,
            capabilities: this.capabilities,
            inputTypes: this.inputTypes,
            isInitialized: this.isInitialized
        };
    }
}
