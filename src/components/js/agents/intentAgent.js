import { BaseAgent } from './baseAgent.js';
import { toolRegistry } from './toolRegistry.js';
import aiService from '../aiService.js';

/**
 * 意图分析 Agent
 * 负责分析用户意图并选择合适的工具
 */
export class IntentAgent extends BaseAgent {
    constructor() {
        super('IntentAgent', '分析用户意图并路由到合适的工具');
        this.intentClassificationPrompt = this.buildIntentPrompt();
    }

    /**
     * 构建意图分类的提示词
     */
    buildIntentPrompt() {
        return `你是一个智能意图分析助手，需要分析用户对表格数据的操作意图。

请根据用户输入，判断应该使用哪个工具来处理请求。

可用工具：
1. general_qa - 通用问答：处理与表格无关的一般性问题
2. table_qa - 表格问答：回答关于表格数据的简单问题，不需要可视化
3. simple_chart - 简易图表：生成基础的图表可视化（柱状图、折线图、饼图等）
4. advanced_analytics - 高级分析：复杂的数据分析和高级可视化（统计分析、相关性分析、预测等）

判断规则：
- 如果没有表格数据，使用 general_qa
- 如果是简单的数据查询、统计、对比问题，使用 table_qa
- 如果需要基础图表展示（如"画个柱状图"、"制作饼图"），使用 simple_chart
- 如果需要复杂分析（如"分析相关性"、"预测趋势"、"聚类分析"），使用 advanced_analytics

请以JSON格式返回结果：
{
  "tool": "工具名称",
  "confidence": 0.0-1.0,
  "reasoning": "选择理由",
  "parameters": {
    "chartType": "图表类型（如果适用）",
    "analysisType": "分析类型（如果适用）"
  }
}`;
    }

    /**
     * 处理用户请求
     * @param {string} userInput - 用户输入
     * @param {Array} tableData - 表格数据
     * @param {Object} context - 上下文
     */
    async process(userInput, tableData = null, context = {}) {
        try {
            console.log('IntentAgent.process 开始处理:', { userInput, hasTableData: !!(tableData && tableData.length > 0) });

            if (!this.validateInput(userInput)) {
                throw new Error('Invalid user input');
            }

            const hasTableData = tableData && tableData.length > 0;

            // 1. 如果没有表格数据，直接使用通用问答工具
            if (!hasTableData) {
                console.log('没有表格数据，使用通用问答工具');
                const tool = toolRegistry.getTool('general_qa');
                if (!tool) {
                    throw new Error('General QA tool not found');
                }
                console.log('执行通用问答工具...');
                const result = await tool.execute(userInput, null, context);
                console.log('通用问答工具执行结果:', result);
                return this.formatResponse(result);
            }

            // 2. 如果有表格数据，调用 LLM 分析意图
            console.log('有表格数据，开始分析意图...');
            const intent = await this.analyzeIntent(userInput, tableData);
            console.log('意图分析结果:', intent);

            // 3. 根据意图选择并执行工具
            const tool = toolRegistry.getTool(intent.tool);
            if (!tool) {
                console.warn(`Tool ${intent.tool} not found, falling back to table_qa`);
                const fallbackTool = toolRegistry.getTool('table_qa');
                if (!fallbackTool) {
                    throw new Error('No suitable tool found');
                }
                const result = await fallbackTool.execute(userInput, tableData, context);
                return this.formatResponse(result);
            }

            // 4. 执行选定的工具
            console.log(`执行工具: ${intent.tool}`);
            const result = await tool.execute(userInput, tableData, {
                ...context,
                intent: intent
            });
            console.log('工具执行结果:', result);

            const finalResponse = this.formatResponse({
                ...result,
                intent: intent
            });
            console.log('最终响应:', finalResponse);

            return finalResponse;

        } catch (error) {
            console.error('IntentAgent.process 错误:', error);
            return this.handleError(error);
        }
    }

    /**
     * 分析用户意图
     * @param {string} userInput - 用户输入
     * @param {Array} tableData - 表格数据
     */
    async analyzeIntent(userInput, tableData) {
        try {
            console.log('🧠 [DEBUG] IntentAgent.analyzeIntent 开始');
            console.log('📝 [DEBUG] 用户输入:', userInput);
            console.log('📊 [DEBUG] 表格数据行数:', tableData.length);

            // 构建分析提示
            const prompt = `${this.intentClassificationPrompt}

用户输入：${userInput}

表格数据概览：
- 行数：${tableData.length}
- 列数：${tableData.length > 0 ? Object.keys(tableData[0]).length : 0}
- 列名：${tableData.length > 0 ? Object.keys(tableData[0]).join(', ') : '无'}

请分析用户意图：`;

            console.log('🤖 [DEBUG] 调用 LLM 进行意图分析...');
            const response = await aiService.callQwenAPI(prompt, '你是一个专业的数据分析意图识别助手。');
            console.log('📤 [DEBUG] LLM 意图分析响应:', response);

            // 尝试解析JSON响应
            let intent;
            try {
                // 提取JSON部分
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    console.log('🔍 [DEBUG] 找到JSON部分:', jsonMatch[0]);
                    intent = JSON.parse(jsonMatch[0]);
                    console.log('✅ [DEBUG] JSON解析成功:', intent);
                } else {
                    throw new Error('No JSON found in response');
                }
            } catch (parseError) {
                console.warn('⚠️ [DEBUG] JSON解析失败，使用关键词匹配:', parseError);
                // 使用关键词匹配作为后备方案
                intent = this.fallbackIntentAnalysis(userInput);
                console.log('🔄 [DEBUG] 关键词匹配结果:', intent);
            }

            // 验证和标准化意图结果
            const finalIntent = this.validateAndNormalizeIntent(intent);
            console.log('🎯 [DEBUG] 最终意图结果:', finalIntent);

            return finalIntent;

        } catch (error) {
            console.error('❌ [DEBUG] 意图分析失败:', error);
            // 返回默认意图
            const defaultIntent = {
                tool: 'table_qa',
                confidence: 0.5,
                reasoning: 'Intent analysis failed, using default table QA',
                parameters: {}
            };
            console.log('🔄 [DEBUG] 使用默认意图:', defaultIntent);
            return defaultIntent;
        }
    }

    /**
     * 后备意图分析（基于关键词）
     * @param {string} userInput - 用户输入
     */
    fallbackIntentAnalysis(userInput) {
        console.log('🔍 [DEBUG] 开始关键词匹配分析:', userInput);
        const input = userInput.toLowerCase();

        // 高级分析关键词（更具体的关键词，优先级更高）
        const advancedKeywords = [
            '相关性', '相关关系', 'correlation',
            '趋势分析', '预测', 'trend', 'forecast', 'predict',
            '聚类', '分组', 'cluster', 'clustering',
            '回归', '统计分析', 'regression', 'statistical',
            '方差', '分布', 'variance', 'distribution'
        ];

        // 简单图表关键词
        const chartKeywords = [
            '图', '图表', '可视化', '画', '绘制', '展示',
            '柱状图', '折线图', '饼图', '散点图',
            'chart', 'plot', 'graph', 'visualize'
        ];

        // 检查匹配的关键词
        const matchedAdvanced = advancedKeywords.filter(keyword => input.includes(keyword));
        const matchedChart = chartKeywords.filter(keyword => input.includes(keyword));

        console.log('🔬 [DEBUG] 匹配的高级分析关键词:', matchedAdvanced);
        console.log('📊 [DEBUG] 匹配的图表关键词:', matchedChart);

        // 优先检查高级分析关键词
        if (matchedAdvanced.length > 0) {
            const result = {
                tool: 'advanced_analytics',
                confidence: 0.8,
                reasoning: `Detected advanced analysis keywords: ${matchedAdvanced.join(', ')}`,
                parameters: { analysisType: 'general' }
            };
            console.log('🎯 [DEBUG] 选择高级分析工具:', result);
            return result;
        }

        // 然后检查图表关键词
        if (matchedChart.length > 0) {
            const result = {
                tool: 'simple_chart',
                confidence: 0.8,
                reasoning: `Detected chart/visualization keywords: ${matchedChart.join(', ')}`,
                parameters: { chartType: 'auto' }
            };
            console.log('📊 [DEBUG] 选择简易图表工具:', result);
            return result;
        }

        const result = {
            tool: 'table_qa',
            confidence: 0.6,
            reasoning: 'Default to table QA',
            parameters: {}
        };
        console.log('💬 [DEBUG] 默认选择表格问答工具:', result);
        return result;
    }

    /**
     * 验证和标准化意图结果
     * @param {Object} intent - 原始意图结果
     */
    validateAndNormalizeIntent(intent) {
        const validTools = ['general_qa', 'table_qa', 'simple_chart', 'advanced_analytics'];
        
        if (!intent.tool || !validTools.includes(intent.tool)) {
            intent.tool = 'table_qa';
        }
        
        if (typeof intent.confidence !== 'number' || intent.confidence < 0 || intent.confidence > 1) {
            intent.confidence = 0.5;
        }
        
        if (!intent.reasoning) {
            intent.reasoning = 'Intent analysis completed';
        }
        
        if (!intent.parameters) {
            intent.parameters = {};
        }
        
        return intent;
    }
}
