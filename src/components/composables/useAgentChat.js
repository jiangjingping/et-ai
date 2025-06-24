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
      currentThought: '', // 新增字段，用于实时显示思考过程
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
          aiMessage.isStreaming = true;
          
          if (log.type === 'log') {
            // 系统日志直接显示
            aiMessage.currentThought = `⚙️ ${log.content}`;
          } 
          else if (log.type === 'step') {
            // 实时显示思考内容
            if (log.thought) {
              aiMessage.currentThought = log.thought;
            }
            
            // 更新步骤信息
            const stepIndex = aiMessage.steps.findIndex(s => s.round === log.round);
            if (stepIndex === -1) {
              // 新步骤：创建并添加到数组
              aiMessage.steps.push({
                round: log.round,
                thought: log.thought || '',
                code: log.code || '',
                execution_result: log.execution_result || {}
              });
            } else {
              // 现有步骤：创建新对象触发响应式更新
              const updatedStep = { ...aiMessage.steps[stepIndex] };
              if (log.thought) updatedStep.thought = log.thought;
              if (log.code) updatedStep.code = log.code;
              if (log.execution_result) updatedStep.execution_result = log.execution_result;
              
              // 替换数组元素触发响应式更新
              aiMessage.steps.splice(stepIndex, 1, updatedStep);
            }
          } 
          else if (log.type === 'report') {
            // 最终报告
            aiMessage.content = log.content?.text || "分析完成。";
            aiMessage.images = log.content?.images || [];
            aiMessage.currentThought = ''; // 清空思考过程
            isLoading.value = false;
            aiMessage.isStreaming = false;
          }
          
          // 强制更新视图
          nextTick(() => {
            window.dispatchEvent(new Event('resize'));
          });
        },
        onComplete: () => {
          // onComplete现在作为最终的保障，确保所有状态都被正确设置
          isLoading.value = false;
          aiMessage.isStreaming = false;
          aiMessage.currentThought = ''; // 确保清空
          if (aiMessage.content.endsWith('...')) {
            aiMessage.content = '分析流程已结束。';
          }
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
