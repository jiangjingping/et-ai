/**
 * 数据分析代理
 * 
 * 该类通过与LLM进行多轮对话来协调，以使用Danfo.js执行数据分析。
 */
class DataAnalysisAgent {
    constructor(llmService, onProgress) {
        this.llmService = llmService; // 调用LLM的服务
        this.onProgress = onProgress; // 用于向UI报告进度的回调函数
        this.conversationHistory = []; // 对话历史
    }

    /**
     * 启动数据分析流程。
     * @param {string} userInput 用户的自然语言查询。
     * @param {Array<Array>} data 从WPS工作表获取的二维数组数据。
     * @returns {Promise<object>} 一个Promise，最终解析为包含分析结果的对象。
     */
    async analyze(userInput, data) {
        console.log("代理：开始分析...");
        this.onProgress({ type: 'system', content: '分析流程启动...' });

        let df = new dfd.DataFrame(data); // 使用 'let' 以便后续可以重新赋值
        
        this.conversationHistory = [{
            role: 'user',
            content: `用户需求: ${userInput}\n数据已加载到名为 df 的 Danfo.js DataFrame中。请开始分析。`
        }];

        const systemPrompt = this.getSystemPrompt();
        const MAX_TURNS = 10; // 最大对话轮数

        for (let i = 0; i < MAX_TURNS; i++) {
            this.onProgress({ type: 'system', content: `第 ${i + 1} 轮分析开始...` });

            const llmResponse = await this.llmService.call(this.conversationHistory, systemPrompt);
            this.conversationHistory.push({ role: 'assistant', content: llmResponse });

            let parsedResponse;
            try {
                parsedResponse = jsyaml.load(llmResponse);
                if (!parsedResponse || !parsedResponse.action) {
                    throw new Error("响应中缺少 'action' 字段。");
                }
            } catch (e) {
                const errorFeedback = `YAML解析失败或格式错误: ${e.message}. 请严格按照YAML格式返回.`;
                this.onProgress({ type: 'system', content: errorFeedback });
                this.conversationHistory.push({ role: 'user', content: errorFeedback });
                continue; // 跳过当前轮次，进入下一轮
            }
            
            this.onProgress({ type: 'system', content: `LLM 思考: ${parsedResponse.thought}` });

            switch (parsedResponse.action) {
                case 'generate_code': {
                    const codeResult = await this.executeCode(parsedResponse.code, df);
                    let feedback;
                    if (codeResult.success) {
                        // 如果代码返回了一个新的DataFrame，则更新我们正在使用的df
                        if (codeResult.data instanceof dfd.DataFrame) {
                            df = codeResult.data;
                            feedback = `代码执行成功。DataFrame已更新，新的shape为: ${df.shape}. 请继续下一步分析。`;
                        } else {
                            // 对于其他类型的结果，直接显示结果字符串
                            const resultStr = JSON.stringify(codeResult.data, null, 2);
                            feedback = `代码执行成功。\n输出:\n\`\`\`\n${resultStr}\n\`\`\`\n请继续下一步分析。`;
                        }
                    } else {
                        feedback = `代码执行失败: ${codeResult.error}\n请修复代码后重试。`;
                    }
                    this.onProgress({ type: 'system', content: feedback });
                    this.conversationHistory.push({ role: 'user', content: feedback });
                    break;
                }
                case 'generate_chart_from_code': {
                    const chartResult = await this.executeCode(parsedResponse.code, df);
                    if (chartResult.success) {
                        this.onProgress({ type: 'system', content: '图表生成成功！' });
                        return {
                            report: parsedResponse.final_report || "分析完成。",
                            plotSpec: chartResult.data
                        };
                    } else {
                        const errorFeedback = `图表代码执行失败: ${chartResult.error}. 请修复代码。`;
                        this.onProgress({ type: 'system', content: errorFeedback });
                        this.conversationHistory.push({ role: 'user', content: errorFeedback });
                    }
                    break;
                }
                case 'analysis_complete': {
                    this.onProgress({ type: 'system', content: '分析完成！' });
                    return {
                        report: parsedResponse.final_report || "分析已完成。",
                        plotSpec: null
                    };
                }
                default: {
                    const errorFeedback = `未知的 action: ${parsedResponse.action}. 请使用指定的action.`;
                    this.onProgress({ type: 'system', content: errorFeedback });
                    this.conversationHistory.push({ role: 'user', content: errorFeedback });
                }
            }
        }

        this.onProgress({ type: 'system', content: '已达到最大分析轮数，流程结束。' });
        return {
            report: "分析已达到最大轮数但未显式完成。",
            plotSpec: null
        };
    }

    /**
     * 执行由LLM生成的Danfo.js代码。
     * @param {string} code 要执行的JavaScript代码。
     * @param {dfd.DataFrame} df 要在代码中使用的Danfo.js DataFrame。
     * @returns {Promise<object>} 执行结果。
     */
    async executeCode(code, df) {
        console.log("代理：正在执行代码...", code);
        this.onProgress({ type: 'system', content: `执行代码:\n${code}` });
        try {
            // 使用 new Function 来更安全地执行代码（相比eval）
            // 该函数可以访问 'df' (当前的DataFrame) 和 'dfd' (Danfo.js库)
            const func = new Function('df', 'dfd', `
                const dataframe = df; // 为了向后兼容，以防LLM使用'dataframe'变量名
                ${code}
            `);
            const result = await func(df, dfd);
            
            return { success: true, data: result };
        } catch (error) {
            console.error("代码执行失败:", error);
            this.onProgress({ type: 'system', content: `代码执行失败: ${error.message}` });
            return { success: false, error: error.message };
        }
    }

    /**
     * 生成给LLM的系统提示。
     */
    getSystemPrompt() {
        return `
你是一个专为WPS表格设计的、使用JavaScript进行数据分析的AI助手。
你的任务是根据用户的需求，编写和执行使用Danfo.js库的代码来分析数据，并使用ECharts生成图表。

**规则:**
1.  **语言和库**: 你必须只使用JavaScript。数据分析请使用Danfo.js，数据可视化请使用ECharts。
2.  **数据源**: 数据已经被加载到一个名为 \`df\` 的Danfo.js DataFrame变量中。你无需再加载数据。
3.  **响应格式**: 你的所有回答都必须是严格的YAML格式。
4.  **核心动作 (action)**:
    *   \`generate_code\`: 当你需要执行数据处理、计算或探索时使用。你的\`code\`字段应包含可执行的Danfo.js代码。
    *   \`generate_chart_from_code\`: 当你准备好生成图表时使用。你的\`code\`字段应返回一个ECharts的option对象。这是分析的最后一步。
    *   \`analysis_complete\`: 如果你认为分析已经完成且无需图表，可以使用此动作，并在\`final_report\`字段中提供总结。

**YAML响应示例:**
\`\`\`yaml
thought: 我需要先查看数据的基本信息，比如行数和列名，以了解数据结构。
action: generate_code
code: |
  return df.shape;
\`\`\`

或者

\`\`\`yaml
thought: 数据已经准备好，现在我要计算每个类别的平均值，并生成一个柱状图。
action: generate_chart_from_code
code: |
  // Danfo.js代码，用于处理数据...
  const grouped = df.groupby(['category']).mean();
  
  // ECharts的option对象
  const option = {
    xAxis: {
      type: 'category',
      data: grouped['category'].values
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      data: grouped['value'].values,
      type: 'bar'
    }]
  };
  return option;
final_report: "图表展示了各类别的平均值。"
\`\`\`
`;
    }
}
