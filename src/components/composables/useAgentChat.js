/* global wps */
import { ref, nextTick } from 'vue';
import aiService from '../js/aiService.js';
import utilFunctions from '../js/util.js';

// Helper function to convert table data to CSV format
function toCSV(data) {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                const value = String(row[header] || '');
                // Escape commas and quotes
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        )
    ];
    return csvRows.join('\n');
}


export function useAgentChat(inputMessage, isTableContextAttached) {
  const isLoading = ref(false);
  const messages = ref([]);

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
      console.error('获取表格数据失败:', error);
      return null;
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.value.trim() || isLoading.value) return;

    const userMessageContent = inputMessage.value.trim();
    addUserMessage(userMessageContent);
    inputMessage.value = '';
    isLoading.value = true;

    const aiMessage = addMessage('ai', '正在连接后端分析服务...', {
      isStreaming: true,
      steps: [],
      currentThought: '',
      images: [], // 确保 images 属性被初始化
    });

    try {
      let tableData = null;
      if (isTableContextAttached.value) {
        tableData = getTableData();
        if (!tableData) {
            addSystemMessage('⚠️ 未能获取到有效的表格数据，将仅进行通用对话。');
        }
      } else {
        addSystemMessage('ℹ️ 未关联表格数据，将进行通用对话。');
      }

      const csvData = tableData ? toCSV(tableData) : '';

      const callbacks = {
        onChunk: (log) => {
          const messageIndex = messages.value.findIndex(m => m.id === aiMessage.id);
          if (messageIndex === -1) return;

          const updatedMessage = { ...messages.value[messageIndex] };
          updatedMessage.isStreaming = true;

          if (log.type === 'log') {
            updatedMessage.currentThought = `⚙️ ${log.content}`;
            messages.value.splice(messageIndex, 1, updatedMessage);
          } 
          else if (log.type === 'step') {
            if (log.thought) {
              updatedMessage.currentThought = log.thought;
            }
            
            const stepIndex = updatedMessage.steps.findIndex(s => s.round === log.round);
            if (stepIndex === -1) {
              updatedMessage.steps.push({
                round: log.round,
                thought: log.thought || '',
                code: log.code || '',
                execution_result: log.execution_result || {}
              });
            } else {
              const updatedStep = { ...updatedMessage.steps[stepIndex] };
              if (log.thought) updatedStep.thought = log.thought;
              if (log.code) updatedStep.code = log.code;
              if (log.execution_result) updatedStep.execution_result = log.execution_result;
              updatedMessage.steps[stepIndex] = updatedStep;
            }
            messages.value.splice(messageIndex, 1, updatedMessage);
          } 
          else if (log.type === 'report') {
            // 当收到最终报告时，保留步骤但默认折叠
            const finalMessage = {
              ...updatedMessage,
              content: log.content?.text || "分析完成。",
              images: log.content?.images || [],
              isMarkdown: true,
              currentThought: '',
              isStreaming: false,
              areStepsVisible: false, // 添加此标志以控制UI
            };

            // 移除最后一个多余的步骤
            if (finalMessage.steps.length > 0) {
              finalMessage.steps = finalMessage.steps.slice(0, -1);
            }

            messages.value.splice(messageIndex, 1, finalMessage);
            isLoading.value = false;
          }
          
          nextTick(() => {
            window.dispatchEvent(new Event('resize'));
          });
        },
        onComplete: () => {
          isLoading.value = false;
          const messageIndex = messages.value.findIndex(m => m.id === aiMessage.id);
          if (messageIndex !== -1) {
            const updatedMessage = { ...messages.value[messageIndex] };
            updatedMessage.isStreaming = false;
            updatedMessage.currentThought = '';
            if (updatedMessage.content.endsWith('...')) {
              updatedMessage.content = '分析流程已结束。';
            }
            messages.value.splice(messageIndex, 1, updatedMessage);
          }
        },
        onError: (error) => {
          addSystemMessage(`❌ 与后端服务通信失败: ${error.message}`);
          isLoading.value = false;
          const messageIndex = messages.value.findIndex(m => m.id === aiMessage.id);
          if (messageIndex !== -1) {
            const updatedMessage = { ...messages.value[messageIndex] };
            updatedMessage.isStreaming = false;
            messages.value.splice(messageIndex, 1, updatedMessage);
          }
        }
      };

      await aiService.callPyBackendServiceStream(userMessageContent, csvData, callbacks);

    } catch (error) {
      console.error('❌ 发送消息失败:', error);
      aiMessage.content = `❌ 抱歉，处理您的问题时出现错误：${error.message}`;
      aiMessage.isStreaming = false;
      isLoading.value = false;
    }
  };

  const clearChat = () => {
    if (confirm('确定要清空所有对话记录吗？')) {
      messages.value = [];
    }
  };

  return {
    isLoading,
    messages,
    addSystemMessage,
    sendMessage,
    clearChat,
  };
}
