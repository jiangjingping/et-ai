/* global wps */
import { ref, computed } from 'vue';
import { IntentAgent } from '../js/agents/intentAgent.js';
import { initializeTools, toolRegistry } from '../js/tools/index.js';
import aiService from '../js/aiService.js';
import utilFunctions from '../js/util.js';

export function useAgentChat(inputMessage, isTableContextAttached) {
  const isLoading = ref(false);
  const messages = ref([]);
  const intentAgent = ref(null);
  const isAgentInitialized = ref(false);

  const hasStreamingMessage = computed(() => {
    return messages.value.some(message => message.isStreaming);
  });

  /**
   * 将对象数组格式的表格数据转换为 Markdown
   */
  const convertTableDataToMarkdown = (tableData) => {
    if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
      return '表格为空';
    }

    try {
      // 获取表头
      const headers = Object.keys(tableData[0]);

      // 构建 Markdown 表格
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
      console.error('转换表格数据为 Markdown 失败:', error);
      return '表格数据转换失败';
    }
  };

  // 初始化 Agent 系统
  const initializeAgent = async () => {
    if (isAgentInitialized.value) return;
    
    try {
      console.log('Initializing Agent system...');
      
      // 初始化所有工具
      await initializeTools();
      
      // 创建意图分析 Agent
      intentAgent.value = new IntentAgent();
      await intentAgent.value.initialize();
      
      isAgentInitialized.value = true;
      console.log('Agent system initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize Agent system:', error);
      addSystemMessage(`❌ Agent系统初始化失败: ${error.message}`);
    }
  };

  const addMessage = (type, content, options = {}) => {
    messages.value.push({
      type,
      content,
      time: new Date().toLocaleTimeString(),
      ...options,
    });
  };

  const addSystemMessage = (content) => addMessage('system', content);
  const addUserMessage = (content) => addMessage('user', content);

  const updateMessageContent = (messageIndex, newContent) => {
    if (!messages.value[messageIndex]) return;
    const message = messages.value[messageIndex];
    message.content = newContent;
    message.fullContent = newContent;
  };

  /**
   * 获取表格数据
   */
  const getTableData = () => {
    try {
      if (typeof wps === 'undefined' || !wps.EtApplication) {
        return null;
      }

      const currentTableMarkdown = utilFunctions.getTableContextDataAsMarkdown();

      if (!currentTableMarkdown || currentTableMarkdown.trim() === '') {
        return null;
      }

      // 尝试解析表格数据为数组格式
      const tableData = utilFunctions.parseMarkdownToTableData(currentTableMarkdown);
      return tableData;
    } catch (error) {
      console.error('Failed to get table data:', error);
      return null;
    }
  };

  /**
   * 处理 Agent 响应（非流式）
   */
  const processAgentResponse = (response, messageIndex) => {
    if (!response || !response.success) {
      const errorMsg = response?.error || 'Agent处理失败';
      console.error('Agent 响应失败:', errorMsg);
      if (messages.value[messageIndex]) {
        messages.value[messageIndex].content = `❌ ${errorMsg}`;
        messages.value[messageIndex].isStreaming = false;
      }
      return;
    }

    const result = response.data;

    if (!result) {
      console.warn('响应数据为空');
      if (messages.value[messageIndex]) {
        messages.value[messageIndex].content = '❌ 响应数据为空';
        messages.value[messageIndex].isStreaming = false;
      }
      return;
    }

    const message = messages.value[messageIndex];
    if (!message) {
      console.error('找不到对应的消息:', messageIndex);
      return;
    }

    // 获取实际的内容数据
    const actualData = result.data || result;

    // 设置基本内容
    const content = actualData.content || result.content || '处理完成，但没有返回内容';
    message.content = content;
    message.fullContent = content;
    message.isStreaming = false;

    // 根据结果类型设置特定属性
    setMessageTypeSpecificProperties(message, actualData, result);

    // 添加意图信息（用于调试）
    if (actualData.intent || result.intent) {
      message.intent = actualData.intent || result.intent;
    }
  };

  /**
   * 处理流式 Agent 响应
   */
  const processAgentStreamResponse = async (userInput, tableData, context, messageIndex) => {
    try {
      console.log('🔄 [DEBUG] 开始流式处理...');

      // 确保 Agent 系统已初始化
      if (!isAgentInitialized.value) {
        console.log('⚠️ [DEBUG] Agent 未初始化，开始初始化...');
        await initializeAgent();
      }

      if (!intentAgent.value) {
        throw new Error('Agent系统未正确初始化');
      }

      // 分析意图
      const hasTableData = tableData && tableData.length > 0;
      console.log('📋 [DEBUG] 是否有表格数据:', hasTableData);

      let toolName = 'general_qa';
      let intent = null;

      if (hasTableData) {
        console.log('🧠 [DEBUG] 开始分析意图...');
        intent = await intentAgent.value.analyzeIntent(userInput, tableData);
        toolName = intent.tool;
        console.log('🎯 [DEBUG] 意图分析结果:', intent);
      } else {
        console.log('💬 [DEBUG] 无表格数据，使用通用问答');
      }

      console.log('🔧 [DEBUG] 选择的工具:', toolName);

      // 获取对应的工具
      const tool = toolRegistry.getTool(toolName);
      if (!tool) {
        throw new Error(`工具 ${toolName} 未找到`);
      }

      console.log('✅ [DEBUG] 工具获取成功:', tool.name);

      // 检查工具是否支持流式输出
      if (toolName === 'general_qa' || toolName === 'table_qa') {
        console.log('💬 [DEBUG] 使用流式问答模式');
        // 对于问答类工具，使用流式输出
        await executeToolWithStream(tool, userInput, tableData, context, messageIndex, intent);
      } else {
        console.log('📊 [DEBUG] 使用流式分析模式 (图表/高级分析)');
        // 对于图表和分析工具，使用流式分析模式
        await executeToolWithProgress(tool, toolName, userInput, tableData, context, messageIndex, intent);
      }

    } catch (error) {
      console.error('流式处理失败:', error);
      if (messages.value[messageIndex]) {
        messages.value[messageIndex].content = `❌ 抱歉，处理您的问题时出现错误：${error.message}`;
        messages.value[messageIndex].isStreaming = false;
      }
    }
  };

  /**
   * 使用流式输出执行工具
   */
  const executeToolWithStream = async (tool, userInput, tableData, context, messageIndex, intent) => {
    const message = messages.value[messageIndex];
    if (!message) return;

    // 构建提示词
    let prompt = userInput;
    let systemPrompt = '';

    if (tool.name === 'general_qa') {
      const isDataRelated = tool.isDataRelatedQuestion(userInput);
      if (isDataRelated) {
        prompt += '\n\n注意：如果你需要分析具体的数据或制作图表，建议你先引用表格数据，这样我可以为你提供更准确和个性化的帮助。';
      }
      systemPrompt = tool.systemPrompt;
    } else if (tool.name === 'table_qa') {
      try {
        // 将对象数组转换为二维数组格式
        const tableMarkdown = convertTableDataToMarkdown(tableData);
        prompt = `用户问题：${userInput}\n\n表格数据：\n${tableMarkdown}\n\n请基于上述表格数据回答用户的问题。`;
      } catch (error) {
        console.error('格式化表格数据失败:', error);
        prompt = `用户问题：${userInput}\n\n表格数据格式化失败，请基于原始数据回答问题。`;
      }
      systemPrompt = tool.systemPrompt;
    }

    // 使用流式API
    let accumulatedContent = '';

    await aiService.callQwenAPIStream(
      prompt,
      systemPrompt,
      // onChunk
      (chunk, fullContent) => {
        accumulatedContent = fullContent;
        if (message) {
          message.content = fullContent;
          message.fullContent = fullContent;
        }
      },
      // onComplete
      (finalContent) => {
        if (message) {
          message.content = finalContent;
          message.fullContent = finalContent;
          message.isStreaming = false;

          // 添加建议提示
          if (tool.name === 'general_qa') {
            const isDataRelated = tool.isDataRelatedQuestion(userInput);
            if (isDataRelated) {
              message.suggestion = '💡 提示：引用表格数据可以获得更精准的分析和可视化服务';
            }
          } else if (tool.name === 'table_qa') {
            // 简单的可视化建议逻辑
            const visualKeywords = ['趋势', '变化', '对比', '分布', '关系', '比例'];
            const input = userInput.toLowerCase();
            const needsVisualization = visualKeywords.some(keyword =>
              input.includes(keyword) || finalContent.toLowerCase().includes(keyword)
            );

            if (needsVisualization) {
              message.suggestion = '💡 建议：这类数据可以通过图表更直观地展示，你可以要求我"制作图表"或"可视化数据"';
            }
          }

          // 添加意图信息
          if (intent) {
            message.intent = intent;
          }
        }
      },
      // onError
      (error) => {
        console.error('流式输出错误:', error);
        if (message) {
          message.content = accumulatedContent + `\n\n❌ 流式输出中断：${error.message}`;
          message.isStreaming = false;
        }
      }
    );
  };

  /**
   * 使用流式输出执行图表和分析工具
   */
  const executeToolWithProgress = async (tool, toolName, userInput, tableData, context, messageIndex, intent) => {
    const message = messages.value[messageIndex];
    if (!message) {
      console.error('❌ [DEBUG] 消息对象不存在:', messageIndex);
      return;
    }

    try {
      console.log(`🔧 [DEBUG] 开始执行工具: ${toolName}`);
      console.log('📝 [DEBUG] 工具详情:', {
        name: tool.name,
        description: tool.description,
        capabilities: tool.capabilities
      });

      // 构建提示词，让 LLM 输出分析过程
      let prompt = '';
      let systemPrompt = '';

      if (toolName === 'simple_chart') {
        console.log('📊 [DEBUG] 构建简易图表提示...');

        // 分析数据特征
        const dataAnalysis = tool.analyzeTableData(tableData);
        console.log('📈 [DEBUG] 数据分析结果:', dataAnalysis);

        const tableMarkdown = tool.formatTableDataAsMarkdown(tableData);
        console.log('📋 [DEBUG] 表格 Markdown 长度:', tableMarkdown.length);

        prompt = tool.buildChartPrompt(userInput, tableMarkdown, dataAnalysis, context);
        systemPrompt = tool.systemPrompt;

        console.log('💭 [DEBUG] 简易图表提示构建完成');

      } else if (toolName === 'advanced_analytics') {
        console.log('🔬 [DEBUG] 执行高级分析工具...');

        // 对于高级分析，我们需要先执行工具的完整流程来获取 Danfo.js 分析结果
        console.log('📊 [DEBUG] 调用 AdvancedAnalyticsTool.execute...');
        const toolResult = await tool.execute(userInput, tableData, { ...context, intent });
        console.log('✅ [DEBUG] AdvancedAnalyticsTool.execute 完成:', toolResult);

        // 如果工具执行成功，直接使用结果
        if (toolResult.success && toolResult.data) {
          const response = intentAgent.value.formatResponse({ ...toolResult.data, intent });
          processAgentResponse(response, messageIndex);
          return; // 直接返回，不需要流式处理
        }

        // 如果工具执行失败，回退到流式分析
        console.warn('⚠️ [DEBUG] 工具执行失败，回退到流式分析');
        const tableMarkdown = convertTableDataToMarkdown(tableData);

        prompt = `用户分析需求：${userInput}

表格数据：
${tableMarkdown}

请按照系统提示的格式进行详细的高级数据分析。`;

        systemPrompt = tool.systemPrompt;
        console.log('💭 [DEBUG] 高级分析回退提示构建完成');
      }

      console.log('📤 [DEBUG] 最终提示词长度:', prompt.length);
      console.log('🎯 [DEBUG] 系统提示词长度:', systemPrompt.length);

      // 使用流式输出显示分析过程
      let accumulatedContent = '';
      let chartConfig = null;
      let plotlyConfig = null;

      console.log('🌊 [DEBUG] 开始流式API调用...');

      await aiService.callQwenAPIStream(
        prompt,
        systemPrompt,
        // onChunk - 流式显示分析过程
        (chunk, fullContent) => {
          accumulatedContent = fullContent;
          if (message) {
            message.content = fullContent;
            message.fullContent = fullContent;
          }
          // console.log('📝 [DEBUG] 流式内容更新，长度:', fullContent.length);
        },
        // onComplete - 处理完整响应并提取图表配置
        async (finalContent) => {
          console.log('✅ [DEBUG] 流式输出完成，最终内容长度:', finalContent.length);

          if (message) {
            message.content = finalContent;
            message.fullContent = finalContent;

            // 尝试提取图表配置
            if (toolName === 'simple_chart') {
              console.log('📊 [DEBUG] 开始提取 ECharts 配置...');
              chartConfig = tool.extractChartConfig(finalContent);
              console.log('📊 [DEBUG] ECharts 配置提取结果:', chartConfig);

              if (chartConfig) {
                message.chartOptions = [chartConfig];
                message.chartType = 'echarts';
                message.content = finalContent + '\n\n📊 **图表已生成**';
                console.log('✅ [DEBUG] ECharts 图表配置设置成功');
              } else {
                console.warn('⚠️ [DEBUG] 未能提取到有效的 ECharts 配置');
              }

            } else if (toolName === 'advanced_analytics') {
              console.log('📈 [DEBUG] 开始提取 Plotly 配置...');
              plotlyConfig = tool.extractPlotlyConfig(finalContent);
              console.log('📈 [DEBUG] Plotly 配置提取结果:', plotlyConfig);

              if (plotlyConfig) {
                message.plotlyConfig = plotlyConfig;
                message.chartType = 'plotly';
                message.content = finalContent + '\n\n📈 **高级分析图表已生成**';
                console.log('✅ [DEBUG] Plotly 图表配置设置成功');
              } else {
                console.warn('⚠️ [DEBUG] 未能提取到有效的 Plotly 配置');
                console.log('🔍 [DEBUG] 最终内容预览:', finalContent.substring(0, 500) + '...');
              }
            }

            message.isStreaming = false;

            // 添加意图信息
            if (intent) {
              message.intent = intent;
            }

            console.log('🏁 [DEBUG] 消息处理完成:', {
              hasChartOptions: !!message.chartOptions,
              hasPlotlyConfig: !!message.plotlyConfig,
              chartType: message.chartType
            });
          }
        },
        // onError
        (error) => {
          console.error(`❌ [DEBUG] ${toolName} 流式输出错误:`, error);
          if (message) {
            message.content = accumulatedContent + `\n\n❌ 处理中断：${error.message}`;
            message.isStreaming = false;
          }
        }
      );

    } catch (error) {
      console.error(`${toolName} 执行失败:`, error);
      message.content = `❌ ${toolName === 'simple_chart' ? '图表生成' : '分析'}失败：${error.message}`;
      message.isStreaming = false;
    }
  };

  /**
   * 设置消息的类型特定属性
   */
  const setMessageTypeSpecificProperties = (message, actualData, result) => {
    const resultType = actualData.type || result.type;
    switch (resultType) {
      case 'simple_chart':
        if (actualData.chartConfig) {
          message.chartOptions = [actualData.chartConfig];
          message.chartType = 'echarts';
        }
        break;

      case 'advanced_analytics':
        if (actualData.analysisResult && actualData.analysisResult.plotlyConfig) {
          message.plotlyConfig = actualData.analysisResult.plotlyConfig;
          message.chartType = 'plotly';
        }
        if (actualData.analysisResult && actualData.analysisResult.processedData) {
          message.processedData = actualData.analysisResult.processedData;
        }
        break;

      case 'table_qa':
        if (actualData.visualizationSuggestion) {
          message.suggestion = actualData.visualizationSuggestion;
        }
        break;

      case 'general_qa':
        if (actualData.suggestion) {
          message.suggestion = actualData.suggestion;
        }
        break;
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.value.trim() || isLoading.value) return;

    // 确保 Agent 系统已初始化
    if (!isAgentInitialized.value) {
      await initializeAgent();
    }

    if (!intentAgent.value) {
      addSystemMessage('❌ Agent系统未正确初始化，请刷新页面重试。');
      return;
    }

    const userMessageContent = inputMessage.value.trim();
    addUserMessage(userMessageContent);
    inputMessage.value = '';
    isLoading.value = true;

    // 获取表格数据
    let tableData = null;
    if (isTableContextAttached.value) {
      try {
        tableData = getTableData();
        if (!tableData) {
          addSystemMessage('⚠️ 未能获取到有效的表格数据（或所选区域为空）。');
        }
      } catch (error) {
        console.error("获取表格数据出错:", error);
        addSystemMessage(`❌ 获取表格数据失败: ${error.message}。`);
      }
    }

    // 添加AI消息占位符
    const aiMessageIndex = messages.value.length;
    addMessage('ai', '正在分析您的请求...', { 
      isStreaming: true, 
      fullContent: '',
      chartOptions: null,
      plotlyConfig: null,
      chartType: null
    });

    try {
      console.log('🚀 [DEBUG] 开始处理用户请求:', userMessageContent);
      console.log('📊 [DEBUG] 表格数据:', tableData);
      console.log('🔗 [DEBUG] 是否引用表格:', isTableContextAttached.value);

      // 使用流式处理
      await processAgentStreamResponse(
        userMessageContent,
        tableData,
        {
          isTableContextAttached: isTableContextAttached.value,
          timestamp: new Date().toISOString()
        },
        aiMessageIndex
      );

    } catch (error) {
      console.error('❌ [DEBUG] Agent处理失败:', error);
      if (messages.value[aiMessageIndex]) {
        messages.value[aiMessageIndex].content = `❌ 抱歉，处理您的问题时出现错误：${error.message}`;
        messages.value[aiMessageIndex].isStreaming = false;
      }
    } finally {
      isLoading.value = false;
    }
  };

  const stopProcessing = () => {
    isLoading.value = false;
    const streamingMessage = messages.value.find(msg => msg.isStreaming);
    if (streamingMessage) {
      streamingMessage.content += '\n\n⏹️ **操作已停止**';
      streamingMessage.isStreaming = false;
    }
    addSystemMessage('⏹️ 已停止当前AI处理请求。');
  };

  const clearChat = () => {
    if (confirm('确定要清空所有对话记录吗？')) {
      messages.value = [];
    }
  };

  // 自动初始化
  initializeAgent();

  return {
    isLoading,
    messages,
    hasStreamingMessage,
    addSystemMessage,
    sendMessage,
    stopProcessing,
    clearChat,
    isAgentInitialized
  };
}
