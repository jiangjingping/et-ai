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
        steps: [] 
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
        // 如果没有表格数据，或许应该调用不同的服务或给出提示
        // 此处暂时依然调用后端，让后端处理无数据的情况
      }

      const csvData = tableData ? toCSV(tableData) : '';

      const callbacks = {
        onChunk: (log) => {
          if (log.type === 'log') {
            aiMessage.content = `⚙️ ${log.content}`;
          } else if (log.type === 'step') {
            const step = {
              thought: log.thought,
              code: log.code,
              execution_result: log.execution_result, // 直接保存整个结果对象
              is_final: log.is_final
            };
            // Add or update the step for the current round
            const existingStepIndex = aiMessage.steps.findIndex(s => s.round === log.round);
            if (existingStepIndex > -1) {
                aiMessage.steps[existingStepIndex] = { ...aiMessage.steps[existingStepIndex], ...step };
            } else {
                aiMessage.steps.push({ round: log.round, ...step });
            }
          } else if (log.type === 'report') {
            const report = log.content || {};
            aiMessage.content = report.text || "分析完成。";
            aiMessage.images = report.images || [];
            // 收到最终报告后，手动调用 onComplete 来结束加载状态
            callbacks.onComplete();
          }
          nextTick(() => window.dispatchEvent(new Event('resize')));
        },
        onComplete: () => {
          isLoading.value = false;
          aiMessage.isStreaming = false;
        },
        onError: (error) => {
          addSystemMessage(`❌ 与后端服务通信失败: ${error.message}`);
          isLoading.value = false;
          aiMessage.isStreaming = false;
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
