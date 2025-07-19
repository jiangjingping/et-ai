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

        // Danfo.js可以直接处理JSON数组，这是更现代和健astrong的方式。
        let df = new dfd.DataFrame(data);

        // 新增的预处理步骤：全局将 null 替换为 NaN，确保数值计算的健壮性
        for (const col of df.columns) {
            const aSeries = df[col];
            const newValues = aSeries.values.map(v => v === null ? NaN : v);
            df.addColumn(col, newValues, { inplace: true });
        }

        this.conversationHistory = [{
            role: 'user',
            content: `用户需求: ${userInput}\n数据已加载到名为 df 的 Danfo.js DataFrame中，并且null值已被自动替换为NaN。请开始分析。`
        }];

        const systemPrompt = window.getDetailedSystemPrompt();
        const MAX_TURNS = 10; // 最大对话轮数

        for (let i = 0; i < MAX_TURNS; i++) {
            this.onProgress({ type: 'system', content: `第 ${i + 1} 轮分析开始...` });

            const llmResponse = await this.llmService.call(this.conversationHistory, systemPrompt);
            this.conversationHistory.push({ role: 'assistant', content: llmResponse });

            let parsedResponse;
            try {
                // 预处理步骤：从LLM响应中提取纯净的YAML代码块
                const yamlRegex = /```yaml\n([\s\S]*?)\n```/;
                const match = llmResponse.match(yamlRegex);
                
                let cleanYaml;
                if (match && match[1]) {
                    cleanYaml = match[1];
                } else {
                    // 如果没有找到标记，则假定整个响应都是YAML（为了兼容性）
                    cleanYaml = llmResponse;
                }
                
                console.log("待解析的yaml：", cleanYaml);
                parsedResponse = jsyaml.load(cleanYaml);

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
                        // 智能处理AI返回的结果
                        if (codeResult.data && typeof codeResult.data === 'object' && 'full_data' in codeResult.data) {
                            // 方案A: AI返回了 { full_data, summary } 结构
                            // 从 full_data (JSON格式) 重建DataFrame以更新状态
                            df = new dfd.DataFrame(codeResult.data.full_data);
                            // 使用 summary 部分生成反馈信息
                            const summaryStr = JSON.stringify(codeResult.data.summary, null, 2);
                            feedback = `代码执行成功。\n输出摘要:\n\`\`\`json\n${summaryStr}\n\`\`\`\n请继续下一步分析。`;
                        } else if (codeResult.data instanceof dfd.DataFrame) {
                            // 方案B: AI直接返回了DataFrame对象 (兼容旧prompt)
                            df = codeResult.data;
                            feedback = `代码执行成功。DataFrame已更新，新的shape为: ${df.shape}. 请继续下一步分析。`;
                        } else {
                            // 方案C: AI返回了其他未知类型的结果
                            const resultStr = JSON.stringify(codeResult.data, null, 2);
                            feedback = `代码执行成功，但返回了未知结构。\n输出:\n\`\`\`\n${resultStr}\n\`\`\`\n请继续下一步分析。`;
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
            // 注入 'df' 和 'dfd' (正确的Danfo.js全局变量名)
            const func = new Function('df', 'dfd', `
                // 为了向后兼容，让 'danfo' 和 'dataframe' 也可用
                const danfo = dfd;
                const dataframe = df;
                ${code}
            `);
            // 将当前的df对象和全局的dfd对象传入
            const result = await func(df, dfd);
            
            return { success: true, data: result };
        } catch (error) {
            console.error("代码执行失败:", error);
            this.onProgress({ type: 'system', content: `代码执行失败: ${error.message}` });
            return { success: false, error: error.message };
        }
    }

}
