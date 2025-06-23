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
1. general_qa - 通用问答：处理与表格无关的一般性问题。
2. table_qa - 表格问答：回答关于表格数据的简单问题，不涉及计算或图表。
3. code_interpreter - 代码解释器：用于任何需要数据分析、计算、转换或可视化的任务。

判断规则：
- 如果没有表格数据，或问题与数据无关，使用 general_qa。
- 如果只是简单地从表格中查找或读取信息，使用 table_qa。
- **任何**涉及计算（如平均值、总和）、数据操作、图表制作（任何类型的图表）、或复杂分析（如趋势、相关性）的请求，**都必须使用 code_interpreter**。

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

        // Code Interpreter 关键词
        const interpreterKeywords = [
            '图', '表', '可视化', '画', '绘制', '展示', '分析', '计算', '统计',
            '平均', '总和', '最大', '最小', '趋势', '预测', '相关性', '分布',
            'chart', 'plot', 'graph', 'visualize', 'analyze', 'calculate', 'stat'
        ];

        const matchedKeywords = interpreterKeywords.filter(keyword => input.includes(keyword));

        if (matchedKeywords.length > 0) {
            const result = {
                tool: 'code_interpreter',
                confidence: 0.8,
                reasoning: `Detected analysis/chart keywords: ${matchedKeywords.join(', ')}`,
                parameters: {}
            };
            console.log('🎯 [DEBUG] 选择 Code Interpreter 工具:', result);
            return result;
        }

        const result = {
            tool: 'table_qa',
            confidence: 0.6,
            reasoning: 'No specific analysis keywords detected, defaulting to table QA.',
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
        const validTools = ['general_qa', 'table_qa', 'code_interpreter'];
        
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
