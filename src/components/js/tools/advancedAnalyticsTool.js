import { BaseTool } from './baseTool.js';
import aiService from '../aiService.js';

/**
 * 高级分析工具
 * 使用 Danfo.js 进行数据处理，Plotly.js 进行高级可视化
 */
export class AdvancedAnalyticsTool extends BaseTool {
    constructor() {
        super(
            'advanced_analytics',
            '执行复杂数据分析和高级可视化（统计分析、相关性分析、预测等）',
            ['statistical_analysis', 'correlation_analysis', 'trend_analysis', 'advanced_visualization', 'data_processing'],
            ['text', 'table_data']
        );
        this.systemPrompt = this.buildSystemPrompt();
    }

    /**
     * 构建系统提示词
     */
    buildSystemPrompt() {
        return `你是一个专业的高级数据分析师，专门执行复杂的数据分析任务。

你的能力：
1. 统计分析：描述性统计、假设检验、方差分析等
2. 相关性分析：计算变量间的相关系数和关系
3. 趋势分析：时间序列分析、趋势预测
4. 数据处理：数据清洗、转换、聚合
5. 高级可视化：复杂图表、多维数据展示

分析流程：
1. **数据探索**：首先分析数据的基本特征和质量
2. **需求理解**：明确用户的具体分析目标
3. **方法选择**：选择最适合的分析方法和算法
4. **结果解释**：提供专业的分析结论和建议
5. **可视化设计**：创建直观的高级图表展示

输出要求：
请按以下结构提供完整的分析过程：

## 🔍 数据探索
[分析数据的基本特征、数据类型、分布情况等]

## 🎯 分析目标
[明确分析的具体目标和要解决的问题]

## 📊 分析方法
[说明选择的分析方法和技术路线]

## 📈 分析结果
[详细的分析过程和发现的规律]

## 💡 结论建议
[基于分析结果的专业结论和建议]

## 📉 可视化配置
如果需要生成图表，请提供 Plotly.js 配置：
\`\`\`json
// Plotly.js 图表配置
\`\`\``;
    }

    /**
     * 执行高级分析
     * @param {string} userInput - 用户输入
     * @param {Array} tableData - 表格数据
     * @param {Object} context - 上下文信息
     */
    async execute(userInput, tableData, context = {}) {
        try {
            console.log('🔬 [DEBUG] AdvancedAnalyticsTool.execute 开始');
            console.log('📝 [DEBUG] 用户输入:', userInput);
            console.log('📊 [DEBUG] 表格数据行数:', tableData.length);

            if (!this.validateInput(userInput, tableData)) {
                throw new Error('Invalid input or table data');
            }

            // 动态导入 Danfo.js
            console.log('📦 [DEBUG] 开始导入 Danfo.js...');
            let dfd;
            try {
                dfd = await import('danfojs');
                console.log('✅ [DEBUG] Danfo.js 导入成功');
            } catch (error) {
                console.error('❌ [DEBUG] Danfo.js 导入失败:', error);
                throw new Error('Danfo.js library is not available');
            }

            // 创建 Danfo.js DataFrame
            console.log('📋 [DEBUG] 创建 Danfo.js DataFrame...');
            const df = new dfd.DataFrame(tableData);
            console.log('✅ [DEBUG] DataFrame 创建成功，形状:', df.shape);

            // 分析数据特征
            console.log('🔍 [DEBUG] 开始 Danfo.js 数据分析...');
            const dataAnalysis = await this.analyzeDataWithDanfo(df, dfd);
            console.log('📈 [DEBUG] Danfo.js 数据分析完成:', dataAnalysis);

            // 生成分析计划
            console.log('💭 [DEBUG] 构建分析提示...');
            const analysisPrompt = this.buildAnalysisPrompt(userInput, dataAnalysis, context);
            console.log('📝 [DEBUG] 分析提示长度:', analysisPrompt.length);

            // 调用LLM生成分析代码
            console.log('🤖 [DEBUG] 调用 LLM 生成分析...');
            const response = await aiService.callQwenAPI(analysisPrompt, this.systemPrompt);
            console.log('📤 [DEBUG] LLM 分析响应长度:', response.length);

            // 执行分析
            console.log('⚙️ [DEBUG] 执行分析代码...');
            const analysisResult = await this.executeAnalysis(df, response, dfd);
            console.log('🏁 [DEBUG] 分析执行完成:', analysisResult);

            const result = {
                content: response,
                analysisResult: analysisResult,
                dataAnalysis: dataAnalysis,
                type: 'advanced_analytics'
            };

            console.log('✅ [DEBUG] AdvancedAnalyticsTool.execute 完成');
            return this.formatResponse(result, 'advanced_analytics');

        } catch (error) {
            console.error('❌ [DEBUG] AdvancedAnalyticsTool.execute 失败:', error);
            return this.handleError(error);
        }
    }

    /**
     * 使用 Danfo.js 分析数据特征
     * @param {DataFrame} df - Danfo.js DataFrame
     * @param {Object} dfd - Danfo.js 库对象
     * @returns {Object} 数据分析结果
     */
    async analyzeDataWithDanfo(df, dfd) {
        try {
            console.log('📊 [DEBUG] analyzeDataWithDanfo 开始');
            console.log('📋 [DEBUG] DataFrame 形状:', df.shape);
            console.log('📝 [DEBUG] DataFrame 列名:', df.columns);

            const analysis = {
                shape: df.shape,
                columns: df.columns,
                dtypes: df.dtypes,
                describe: {},
                correlations: null,
                nullCounts: {}
            };

            console.log('🔍 [DEBUG] 分析数据类型:', df.dtypes);

            // 获取数值列的描述性统计
            console.log('🔢 [DEBUG] 查找数值列...');
            let numericColumns = [];

            try {
                // 方法1: 尝试使用 selectDtypes
                if (typeof df.selectDtypes === 'function') {
                    numericColumns = df.selectDtypes(['float32', 'int32']).columns;
                } else {
                    // 方法2: 手动检测数值列
                    console.log('⚠️ [DEBUG] selectDtypes 不可用，手动检测数值列...');
                    numericColumns = df.columns.filter(col => {
                        try {
                            const colData = df[col];
                            // 检查列的数据类型
                            const dtype = df.dtypes[col];
                            return dtype === 'float32' || dtype === 'int32' || dtype === 'number';
                        } catch (e) {
                            return false;
                        }
                    });
                }
            } catch (error) {
                console.warn('⚠️ [DEBUG] 数值列检测失败:', error);
                numericColumns = [];
            }

            console.log('📈 [DEBUG] 数值列:', numericColumns);

            if (numericColumns.length > 0) {
                console.log('📊 [DEBUG] 计算描述性统计...');
                let numericDf = null;

                try {
                    numericDf = df.loc({ columns: numericColumns });

                    // 尝试计算描述性统计
                    if (typeof numericDf.describe === 'function') {
                        const describeResult = numericDf.describe();
                        analysis.describe = dfd.toJSON(describeResult, { format: 'row' });
                    } else {
                        console.log('⚠️ [DEBUG] describe 方法不可用，跳过描述性统计');
                        analysis.describe = {};
                    }
                    console.log('✅ [DEBUG] 描述性统计完成');
                } catch (descError) {
                    console.warn('⚠️ [DEBUG] 描述性统计计算失败:', descError);
                    analysis.describe = {};
                }

                // 计算相关性矩阵（如果有多个数值列）
                if (numericColumns.length > 1 && numericDf) {
                    console.log('🔗 [DEBUG] 计算相关性矩阵...');
                    try {
                        // 尝试不同的相关性计算方法
                        let corrResult = null;

                        // 方法1: 尝试使用 corr() 方法
                        if (typeof numericDf.corr === 'function') {
                            corrResult = numericDf.corr();
                        }
                        // 方法2: 尝试使用 dfd.corr() 函数
                        else if (typeof dfd.corr === 'function') {
                            corrResult = dfd.corr(numericDf);
                        }
                        // 方法3: 手动计算简单的相关性
                        else {
                            console.log('⚠️ [DEBUG] 相关性方法不可用，跳过相关性计算');
                            analysis.correlations = null;
                        }

                        if (corrResult) {
                            analysis.correlations = dfd.toJSON(corrResult, { format: 'row' });
                            console.log('✅ [DEBUG] 相关性矩阵计算完成');
                        }
                    } catch (corrError) {
                        console.warn('⚠️ [DEBUG] 相关性矩阵计算失败:', corrError);
                        analysis.correlations = null;
                    }
                }
            } else {
                console.log('⚠️ [DEBUG] 未找到数值列');
            }

            // 计算空值数量
            console.log('🔍 [DEBUG] 计算空值统计...');
            try {
                df.columns.forEach(col => {
                    try {
                        if (df[col] && typeof df[col].isNa === 'function') {
                            analysis.nullCounts[col] = df[col].isNa().sum();
                        } else {
                            // 手动计算空值
                            const colValues = dfd.toJSON(df[col], { format: 'column' });
                            analysis.nullCounts[col] = colValues.filter(val => val === null || val === undefined || val === '').length;
                        }
                    } catch (colError) {
                        console.warn(`⚠️ [DEBUG] 列 ${col} 空值统计失败:`, colError);
                        analysis.nullCounts[col] = 0;
                    }
                });
                console.log('✅ [DEBUG] 空值统计完成');
            } catch (nullError) {
                console.warn('⚠️ [DEBUG] 空值统计失败:', nullError);
            }

            console.log('🏁 [DEBUG] analyzeDataWithDanfo 完成:', analysis);
            return analysis;
        } catch (error) {
            console.error('❌ [DEBUG] Danfo.js 数据分析失败:', error);
            return {
                shape: [0, 0],
                columns: [],
                dtypes: {},
                describe: {},
                correlations: null,
                nullCounts: {}
            };
        }
    }

    /**
     * 构建分析提示
     * @param {string} userInput - 用户输入
     * @param {Object} dataAnalysis - 数据分析结果
     * @param {Object} context - 上下文
     */
    buildAnalysisPrompt(userInput, dataAnalysis, context) {
        let prompt = `用户分析需求：${userInput}\n\n`;
        
        prompt += `数据概览：
- 数据维度：${dataAnalysis.shape[0]}行 × ${dataAnalysis.shape[1]}列
- 列名：${dataAnalysis.columns.join(', ')}
- 数据类型：${JSON.stringify(dataAnalysis.dtypes, null, 2)}
- 空值统计：${JSON.stringify(dataAnalysis.nullCounts, null, 2)}

`;

        if (Object.keys(dataAnalysis.describe).length > 0) {
            prompt += `数值列统计信息：
${JSON.stringify(dataAnalysis.describe, null, 2)}

`;
        }

        if (dataAnalysis.correlations) {
            prompt += `相关性矩阵：
${JSON.stringify(dataAnalysis.correlations, null, 2)}

`;
        }

        prompt += `请根据用户需求和数据特征，提供详细的分析方案和实现代码。`;

        return prompt;
    }

    /**
     * 执行分析代码
     * @param {DataFrame} df - Danfo.js DataFrame
     * @param {string} response - LLM响应
     * @param {Object} dfd - Danfo.js 库对象
     * @returns {Object} 分析结果
     */
    async executeAnalysis(df, response, dfd) {
        try {
            // 提取JavaScript代码
            const jsCode = this.extractJavaScriptCode(response);

            // 提取Plotly配置
            const plotlyConfig = this.extractPlotlyConfig(response);

            // 执行数据处理代码
            let processedData = null;
            if (jsCode) {
                processedData = await this.executeDataProcessing(df, jsCode, dfd);
            }

            return {
                originalData: dfd.toJSON(df, { format: 'row' }),
                processedData: processedData,
                plotlyConfig: plotlyConfig,
                executedCode: jsCode,
                success: true
            };
        } catch (error) {
            console.error('Analysis execution failed:', error);
            return {
                originalData: null,
                processedData: null,
                plotlyConfig: this.generateFallbackPlotlyConfig(),
                executedCode: null,
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 提取JavaScript代码
     * @param {string} response - LLM响应
     * @returns {string|null} JavaScript代码
     */
    extractJavaScriptCode(response) {
        const jsMatch = response.match(/```javascript\s*([\s\S]*?)\s*```/);
        return jsMatch ? jsMatch[1] : null;
    }

    /**
     * 提取Plotly配置
     * @param {string} response - LLM响应
     * @returns {Object|null} Plotly配置
     */
    extractPlotlyConfig(response) {
        try {
            console.log('🔍 [DEBUG] AdvancedAnalyticsTool.extractPlotlyConfig 开始');
            console.log('📝 [DEBUG] 响应内容长度:', response.length);

            // 查找JSON代码块
            const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                console.log('✅ [DEBUG] 找到JSON代码块');
                console.log('🔍 [DEBUG] JSON内容:', jsonMatch[1]);
                const config = JSON.parse(jsonMatch[1]);
                console.log('✅ [DEBUG] Plotly配置解析成功:', config);
                return config;
            }

            // 如果没找到代码块，尝试查找普通JSON对象
            const objectMatch = response.match(/\{[\s\S]*"data"[\s\S]*\}/);
            if (objectMatch) {
                console.log('✅ [DEBUG] 找到JSON对象');
                console.log('🔍 [DEBUG] JSON内容:', objectMatch[0]);
                const config = JSON.parse(objectMatch[0]);
                console.log('✅ [DEBUG] Plotly配置解析成功:', config);
                return config;
            }

            console.warn('⚠️ [DEBUG] 未找到有效的Plotly配置');
            console.log('📄 [DEBUG] 响应内容预览:', response.substring(0, 500) + '...');
            return null;
        } catch (error) {
            console.error('❌ [DEBUG] 提取Plotly配置失败:', error);
            return null;
        }
    }

    /**
     * 执行数据处理代码
     * @param {DataFrame} df - 原始DataFrame
     * @param {string} code - 处理代码
     * @param {Object} dfd - Danfo.js 库对象
     * @returns {Object} 处理结果
     */
    async executeDataProcessing(df, code, dfd) {
        try {
            // 创建安全的执行环境
            const context = {
                df: df,
                dfd: dfd,
                result: null,
                console: console
            };

            // 包装代码以捕获结果
            const wrappedCode = `
                try {
                    ${code}
                    // 如果代码中没有设置result，尝试返回df
                    if (result === null && typeof df !== 'undefined') {
                        result = dfd.toJSON(df, { format: 'row' });
                    }
                } catch (error) {
                    console.error('Code execution error:', error);
                    result = { error: error.message };
                }
            `;

            // 使用Function构造器执行代码
            const func = new Function('df', 'dfd', 'result', 'console', wrappedCode);
            func(context.df, context.dfd, context.result, context.console);

            return context.result;
        } catch (error) {
            console.error('Data processing execution failed:', error);
            return { error: error.message };
        }
    }

    /**
     * 生成后备Plotly配置
     * @returns {Object} 基础Plotly配置
     */
    generateFallbackPlotlyConfig() {
        return {
            data: [{
                x: ['分析', '结果', '展示'],
                y: [1, 2, 3],
                type: 'bar',
                name: '数据分析结果'
            }],
            layout: {
                title: '数据分析结果',
                xaxis: { title: '类别' },
                yaxis: { title: '数值' }
            }
        };
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

        // 检查是否有足够的数据进行高级分析
        if (tableData.length < 2) {
            return false;
        }

        return true;
    }
}
