/* global wps */
import { ref, computed } from 'vue';
import { IntentAgent } from '../js/agents/intentAgent.js';
import { initializeTools } from '../js/tools/index.js';
import utilFunctions from '../js/util.js';

export function useAgentChat(inputMessage, isTableContextAttached) {
  const isLoading = ref(false);
  const messages = ref([]);
  const intentAgent = ref(null);
  const isAgentInitialized = ref(false);
  const MAX_ITERATIONS = 10; // 防止无限循环

  const hasStreamingMessage = computed(() => {
    return messages.value.some(message => message.isStreaming);
  });

  // 初始化 Agent 系统
  const initializeAgent = async () => {
    if (isAgentInitialized.value) return;
    
    try {
      console.log('Initializing Agent system...');
      await initializeTools();
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
    const message = {
      id: Date.now() + Math.random(),
      type,
      content,
      time: new Date().toLocaleTimeString(),
      ...options,
    };
    messages.value.push(message);
    return message;
  };

  const addSystemMessage = (content) => addMessage('system', content);
  const addUserMessage = (content) => addMessage('user', content);

  const getTableData = () => {
    try {
      if (typeof wps === 'undefined' || !wps.EtApplication) return null;
      const markdown = utilFunctions.getTableContextDataAsMarkdown();
      return markdown ? utilFunctions.parseMarkdownToTableData(markdown) : null;
    } catch (error) {
      console.error('Failed to get table data:', error);
      return null;
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.value.trim() || isLoading.value) return;

    if (!isAgentInitialized.value) await initializeAgent();
    if (!intentAgent.value) {
      addSystemMessage('❌ Agent系统未正确初始化，请刷新页面重试。');
      return;
    }

    const userMessageContent = inputMessage.value.trim();
    addUserMessage(userMessageContent);
    inputMessage.value = '';
    isLoading.value = true;

    const aiMessage = addMessage('ai', '正在分析您的请求...', { isStreaming: true, thoughts: [] });

    try {
      let tableData = null;
      if (isTableContextAttached.value) {
        tableData = getTableData();
        if (!tableData) addSystemMessage('⚠️ 未能获取到有效的表格数据。');
      }

      // 统一调用 Agent 的 process 方法，它现在只负责意图识别
      const intentResponse = await intentAgent.value.analyzeIntent(userMessageContent, tableData);
      const toolName = intentResponse.tool;

      if (toolName !== 'code_interpreter') {
        // 对于非代码解释器工具，直接执行并返回
        const tool = (await import('../js/tools/index.js')).toolRegistry.getTool(toolName);
        const result = await tool.execute(userMessageContent, tableData);
        aiMessage.content = result.content;
        aiMessage.isStreaming = false;
        return;
      }

      // --- 多轮迭代循环 ---
      let iterationCount = 0;
      let sessionHistory = [];
      let shouldContinue = true;

      while (shouldContinue && iterationCount < MAX_ITERATIONS) {
        iterationCount++;
        
        const tool = (await import('../js/tools/index.js')).toolRegistry.getTool('code_interpreter');
        
        // 执行一步分析
        const stepResult = await tool.execute(userMessageContent, tableData, sessionHistory);

        // 更新UI，显示思考过程
        aiMessage.thoughts.push({
            thought: stepResult.thought,
            code: stepResult.code,
            result: stepResult.result,
            error: stepResult.error
        });
        aiMessage.content = `⚙️ **第 ${iterationCount} 步:** ${stepResult.thought}`;

        if (!stepResult.success) {
            addSystemMessage(`❌ 在第 ${iterationCount} 步分析中出错: ${stepResult.error}`);
            shouldContinue = false; // 出错则停止
        } else {
            sessionHistory.push(stepResult);
            shouldContinue = stepResult.continue;
        }
        
        // 如果循环结束，设置最终结果
        if (!shouldContinue) {
            aiMessage.content = stepResult.content || "分析完成。";
            if (stepResult.plotlyConfig) {
                aiMessage.plotlyConfig = stepResult.plotlyConfig;
                aiMessage.chartType = 'plotly';
            }
        }
      }

      if (iterationCount >= MAX_ITERATIONS) {
        addSystemMessage('⚠️ 已达到最大分析步数，自动停止。');
      }

    } catch (error) {
      console.error('❌ Agent处理失败:', error);
      aiMessage.content = `❌ 抱歉，处理您的问题时出现错误：${error.message}`;
    } finally {
      aiMessage.isStreaming = false;
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
