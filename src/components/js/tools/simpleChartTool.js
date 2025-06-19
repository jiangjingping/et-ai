import { BaseTool } from './baseTool.js';
import aiService from '../aiService.js';
import Util from '../util.js';

/**
 * 简易图表工具
 * 生成基础的ECharts图表配置
 */
export class SimpleChartTool extends BaseTool {
    constructor() {
        super(
            'simple_chart',
            '生成基础图表可视化（柱状图、折线图、饼图等）',
            ['bar_chart', 'line_chart', 'pie_chart', 'scatter_chart', 'basic_visualization'],
            ['text', 'table_data']
        );
        this.systemPrompt = this.buildSystemPrompt();
    }

    /**
     * 构建系统提示词
     */
    buildSystemPrompt() {
        return `你是一个专业的数据可视化助手，专门生成ECharts图表配置。

你的任务：
1. 首先分析表格数据的特征和用户需求
2. 解释选择图表类型的原因
3. 生成合适的ECharts配置
4. 支持的图表类型：柱状图(bar)、折线图(line)、饼图(pie)、散点图(scatter)

分析和输出流程：
1. **数据分析**：分析表格的列类型、数据分布、适合的可视化方式
2. **图表选择**：根据数据特征和用户需求选择最合适的图表类型
3. **设计说明**：解释图表的设计思路和配置要点
4. **配置生成**：提供完整的ECharts配置

图表配置要求：
1. 必须是完整的ECharts配置对象
2. 包含title、tooltip、legend、xAxis、yAxis（如适用）、series等基本配置
3. 数据要准确映射表格内容
4. 颜色搭配要美观协调
5. 标题要简洁明了

输出格式：
请按以下格式输出，包含分析过程和最终配置：

## 数据分析
[分析表格数据的特征]

## 图表设计
[说明选择的图表类型和设计思路]

## ECharts配置
请在回答中包含完整的JSON配置，格式如下：
\`\`\`json
{
  "title": {
    "text": "图表标题",
    "left": "center"
  },
  "tooltip": {
    "trigger": "axis"
  },
  "legend": {
    "data": ["系列名称"]
  },
  "xAxis": {
    "type": "category",
    "data": ["类别1", "类别2"]
  },
  "yAxis": {
    "type": "value"
  },
  "series": [{
    "name": "系列名称",
    "type": "bar",
    "data": [数据数组]
  }]
}
\`\`\`

注意：
- 根据数据特点选择最合适的图表类型
- 如果用户没有指定图表类型，根据数据自动选择
- 确保数据映射正确，避免错误的可视化`;
    }

    /**
     * 执行简易图表生成
     * @param {string} userInput - 用户输入
     * @param {Array} tableData - 表格数据
     * @param {Object} context - 上下文信息
     */
    async execute(userInput, tableData, context = {}) {
        try {
            if (!this.validateInput(userInput, tableData)) {
                throw new Error('Invalid input or table data');
            }

            // 分析数据特征
            const dataAnalysis = this.analyzeTableData(tableData);
            
            // 格式化表格数据
            const tableMarkdown = this.formatTableDataAsMarkdown(tableData);
            
            // 构建图表生成提示
            const chartPrompt = this.buildChartPrompt(userInput, tableMarkdown, dataAnalysis, context);
            
            // 调用LLM生成图表配置
            const response = await aiService.callQwenAPI(chartPrompt, this.systemPrompt);
            
            // 提取JSON配置
            const chartConfig = this.extractChartConfig(response);
            
            const result = {
                content: response,
                chartConfig: chartConfig,
                type: 'simple_chart',
                dataAnalysis: dataAnalysis,
                chartType: this.detectChartType(chartConfig)
            };

            return this.formatResponse(result, 'simple_chart');

        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * 分析表格数据特征
     * @param {Array} tableData - 表格数据
     * @returns {Object} 数据分析结果
     */
    analyzeTableData(tableData) {
        if (!tableData || tableData.length === 0) {
            return { rows: 0, columns: 0, numericColumns: [], textColumns: [] };
        }

        const headers = Object.keys(tableData[0]);
        const numericColumns = [];
        const textColumns = [];
        
        // 分析每列的数据类型
        headers.forEach(header => {
            const values = tableData.map(row => row[header]).filter(val => val !== null && val !== undefined);
            const numericValues = values.filter(val => !isNaN(Number(val)));
            
            if (numericValues.length > values.length * 0.8) {
                numericColumns.push(header);
            } else {
                textColumns.push(header);
            }
        });

        return {
            rows: tableData.length,
            columns: headers.length,
            headers: headers,
            numericColumns: numericColumns,
            textColumns: textColumns,
            sampleData: tableData.slice(0, 3) // 前3行作为样本
        };
    }

    /**
     * 构建图表生成提示
     * @param {string} userInput - 用户输入
     * @param {string} tableMarkdown - 表格Markdown
     * @param {Object} dataAnalysis - 数据分析结果
     * @param {Object} context - 上下文
     */
    buildChartPrompt(userInput, tableMarkdown, dataAnalysis, context) {
        let prompt = `用户需求：${userInput}\n\n`;
        
        prompt += `数据分析：
- 数据行数：${dataAnalysis.rows}
- 数据列数：${dataAnalysis.columns}
- 数值列：${dataAnalysis.numericColumns.join(', ') || '无'}
- 文本列：${dataAnalysis.textColumns.join(', ') || '无'}

`;

        prompt += `表格数据：
${tableMarkdown}

`;

        // 添加图表类型建议
        if (context.intent && context.intent.parameters && context.intent.parameters.chartType) {
            prompt += `建议图表类型：${context.intent.parameters.chartType}\n\n`;
        }

        prompt += `请根据用户需求和数据特点，生成最合适的ECharts图表配置。`;

        return prompt;
    }

    /**
     * 提取图表配置JSON
     * @param {string} response - LLM响应
     * @returns {Object|null} 图表配置对象
     */
    extractChartConfig(response) {
        try {
            // 查找JSON代码块
            const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1]);
            }
            
            // 查找普通JSON对象
            const objectMatch = response.match(/\{[\s\S]*\}/);
            if (objectMatch) {
                return JSON.parse(objectMatch[0]);
            }
            
            throw new Error('No valid JSON found in response');
        } catch (error) {
            console.error('Failed to extract chart config:', error);
            return this.generateFallbackChart();
        }
    }

    /**
     * 生成后备图表配置
     * @returns {Object} 基础图表配置
     */
    generateFallbackChart() {
        return {
            title: {
                text: '数据图表',
                left: 'center'
            },
            tooltip: {
                trigger: 'axis'
            },
            xAxis: {
                type: 'category',
                data: ['数据1', '数据2', '数据3']
            },
            yAxis: {
                type: 'value'
            },
            series: [{
                name: '数据系列',
                type: 'bar',
                data: [10, 20, 30]
            }]
        };
    }

    /**
     * 检测图表类型
     * @param {Object} chartConfig - 图表配置
     * @returns {string} 图表类型
     */
    detectChartType(chartConfig) {
        if (!chartConfig || !chartConfig.series || chartConfig.series.length === 0) {
            return 'unknown';
        }
        
        return chartConfig.series[0].type || 'bar';
    }

    /**
     * 格式化表格数据为Markdown
     * @param {Array} tableData - 表格数据
     * @returns {string} Markdown格式的表格
     */
    formatTableDataAsMarkdown(tableData) {
        try {
            // 将对象数组转换为 Markdown
            if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
                return '表格为空';
            }

            const headers = Object.keys(tableData[0]);
            let markdown = '';

            // 添加表头
            markdown += '| ' + headers.join(' | ') + ' |\n';

            // 添加分隔符
            markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

            // 添加数据行
            tableData.forEach(row => {
                const values = headers.map(header => {
                    const value = row[header];
                    return value !== null && value !== undefined ? String(value) : '';
                });
                markdown += '| ' + values.join(' | ') + ' |\n';
            });

            return markdown;
        } catch (error) {
            console.warn('Failed to format table data:', error);
            return '表格数据格式化失败';
        }
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
