import { BaseTool } from './baseTool.js';
import aiService from '../aiService.js';
import Util from '../util.js';

/**
 * 表格问答工具
 * 处理关于表格数据的简单问答，不涉及可视化
 */
export class TableQATool extends BaseTool {
    constructor() {
        super(
            'table_qa',
            '基于表格数据回答问题，提供数据查询和简单统计',
            ['data_query', 'simple_statistics', 'data_summary', 'data_comparison'],
            ['text', 'table_data']
        );
        this.systemPrompt = this.buildSystemPrompt();
    }

    /**
     * 构建系统提示词
     */
    buildSystemPrompt() {
        return `你是一个专业的数据分析助手，专门回答关于表格数据的问题。

你的能力：
1. 数据查询：帮助用户查找特定的数据信息
2. 简单统计：计算总和、平均值、最大值、最小值等基础统计指标
3. 数据对比：比较不同数据项之间的差异
4. 数据总结：概括数据的主要特征和趋势

回答要求：
1. 基于提供的表格数据进行准确回答
2. 如果数据不足以回答问题，明确说明
3. 提供具体的数字和事实，避免模糊表述
4. 回答要简洁明了，重点突出
5. 如果用户需要图表可视化，建议他们明确提出制作图表的需求

注意：
- 只回答基于现有数据的问题
- 不要进行复杂的预测或推断
- 如果需要复杂分析，建议用户明确提出分析需求`;
    }

    /**
     * 执行表格问答
     * @param {string} userInput - 用户输入
     * @param {Array} tableData - 表格数据
     * @param {Object} context - 上下文信息
     */
    async execute(userInput, tableData, context = {}) {
        try {
            if (!this.validateInput(userInput, tableData)) {
                throw new Error('Invalid input or table data');
            }

            // 格式化表格数据为Markdown
            const tableMarkdown = this.formatTableDataAsMarkdown(tableData);
            
            // 构建完整的提示
            const fullPrompt = `用户问题：${userInput}

表格数据：
${tableMarkdown}

请基于上述表格数据回答用户的问题。`;

            // 调用LLM进行问答
            const response = await aiService.callQwenAPI(fullPrompt, this.systemPrompt);

            // 分析是否建议可视化
            const visualizationSuggestion = this.analyzeVisualizationNeed(userInput, response);

            const result = {
                content: response,
                type: 'text',
                dataSource: {
                    rows: tableData.length,
                    columns: tableData.length > 0 ? Object.keys(tableData[0]).length : 0
                },
                visualizationSuggestion: visualizationSuggestion
            };

            return this.formatResponse(result, 'table_qa');

        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * 格式化表格数据为Markdown
     * @param {Array} tableData - 表格数据
     * @returns {string} Markdown格式的表格
     */
    formatTableDataAsMarkdown(tableData) {
        if (!tableData || tableData.length === 0) {
            return '表格为空';
        }

        try {
            // 使用现有的工具函数
            return Util.formatTableDataAsMarkdown(tableData);
        } catch (error) {
            console.warn('Failed to format table data, using fallback method:', error);
            return this.fallbackFormatTable(tableData);
        }
    }

    /**
     * 后备表格格式化方法
     * @param {Array} tableData - 表格数据
     * @returns {string} 简单格式的表格
     */
    fallbackFormatTable(tableData) {
        if (!tableData || tableData.length === 0) {
            return '表格为空';
        }

        const headers = Object.keys(tableData[0]);
        let result = `表格数据（共${tableData.length}行，${headers.length}列）：\n\n`;
        
        // 添加表头
        result += headers.join(' | ') + '\n';
        result += headers.map(() => '---').join(' | ') + '\n';
        
        // 添加数据行（最多显示前10行）
        const displayRows = Math.min(tableData.length, 10);
        for (let i = 0; i < displayRows; i++) {
            const row = tableData[i];
            const values = headers.map(header => {
                const value = row[header];
                return value !== null && value !== undefined ? String(value) : '';
            });
            result += values.join(' | ') + '\n';
        }
        
        if (tableData.length > 10) {
            result += `... (还有${tableData.length - 10}行数据)\n`;
        }
        
        return result;
    }

    /**
     * 分析是否需要可视化建议
     * @param {string} userInput - 用户输入
     * @param {string} response - AI回答
     * @returns {string|null} 可视化建议
     */
    analyzeVisualizationNeed(userInput, response) {
        const visualKeywords = ['趋势', '变化', '对比', '分布', '关系', '比例'];
        const input = userInput.toLowerCase();
        
        const needsVisualization = visualKeywords.some(keyword => 
            input.includes(keyword) || response.toLowerCase().includes(keyword)
        );
        
        if (needsVisualization) {
            return '💡 建议：这类数据可以通过图表更直观地展示，你可以要求我"制作图表"或"可视化数据"';
        }
        
        return null;
    }

    /**
     * 验证输入（重写父类方法）
     * @param {string} userInput - 用户输入
     * @param {Array} tableData - 表格数据
     * @returns {boolean} 是否有效
     */
    validateInput(userInput, tableData) {
        if (!super.validateInput(userInput)) {
            return false;
        }
        
        if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
            return false;
        }
        
        return true;
    }
}
