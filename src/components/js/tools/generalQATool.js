import { BaseTool } from './baseTool.js';
import aiService from '../aiService.js';

/**
 * 通用问答工具
 * 处理与表格无关的一般性问题
 */
export class GeneralQATool extends BaseTool {
    constructor() {
        super(
            'general_qa',
            '处理通用问题和一般性咨询',
            ['general_conversation', 'knowledge_qa', 'help_support'],
            ['text']
        );
        this.systemPrompt = this.buildSystemPrompt();
    }

    /**
     * 构建系统提示词
     */
    buildSystemPrompt() {
        return `你是一个智能助手，专门帮助用户解答各种问题。

当前情况：用户没有提供表格数据，或者问题与表格数据无关。

你的任务：
1. 友好、专业地回答用户的问题
2. 如果问题涉及数据分析或表格操作，提示用户可以引用表格数据获得更好的帮助
3. 保持回答简洁明了，避免过于冗长

特别提示：
- 如果用户询问关于数据分析、图表制作、表格操作等问题，建议他们引用表格数据
- 对于技术问题，提供准确的信息和建议
- 保持友好和专业的语调`;
    }

    /**
     * 执行通用问答
     * @param {string} userInput - 用户输入
     * @param {Array} tableData - 表格数据（通常为null）
     * @param {Object} context - 上下文信息
     */
    async execute(userInput, tableData = null, context = {}) {
        try {
            console.log('GeneralQATool.execute 开始执行:', userInput);

            if (!this.validateInput(userInput)) {
                throw new Error('Invalid user input');
            }

            // 检查是否涉及数据分析相关问题
            const isDataRelated = this.isDataRelatedQuestion(userInput);
            console.log('是否为数据相关问题:', isDataRelated);

            let enhancedPrompt = userInput;
            if (isDataRelated) {
                enhancedPrompt += '\n\n注意：如果你需要分析具体的数据或制作图表，建议你先引用表格数据，这样我可以为你提供更准确和个性化的帮助。';
            }

            console.log('调用 LLM API...');
            console.log('增强提示:', enhancedPrompt);
            console.log('系统提示:', this.systemPrompt);

            // 调用LLM进行问答
            const response = await aiService.callQwenAPI(enhancedPrompt, this.systemPrompt);
            console.log('LLM 响应:', response);

            const result = {
                content: response,
                type: 'text',
                isDataRelated: isDataRelated,
                suggestion: isDataRelated ? '💡 提示：引用表格数据可以获得更精准的分析和可视化服务' : null
            };

            console.log('GeneralQATool 结果:', result);
            const formattedResponse = this.formatResponse(result, 'general_qa');
            console.log('GeneralQATool 格式化响应:', formattedResponse);

            return formattedResponse;

        } catch (error) {
            console.error('GeneralQATool.execute 错误:', error);
            return this.handleError(error);
        }
    }

    /**
     * 判断是否为数据相关问题
     * @param {string} userInput - 用户输入
     * @returns {boolean} 是否为数据相关问题
     */
    isDataRelatedQuestion(userInput) {
        const dataKeywords = [
            // 中文关键词
            '数据', '表格', '图表', '分析', '统计', '可视化', '柱状图', '折线图', '饼图',
            '趋势', '对比', '汇总', '筛选', '排序', '计算', '公式', '函数',
            // 英文关键词
            'data', 'table', 'chart', 'analysis', 'statistics', 'visualization',
            'graph', 'plot', 'trend', 'compare', 'summary', 'filter', 'sort',
            'calculate', 'formula', 'function'
        ];

        const input = userInput.toLowerCase();
        return dataKeywords.some(keyword => input.includes(keyword));
    }

    /**
     * 验证输入（重写父类方法）
     * @param {string} userInput - 用户输入
     * @returns {boolean} 是否有效
     */
    validateInput(userInput) {
        return super.validateInput(userInput) && userInput.trim().length >= 2;
    }
}
