/* global wps */
import { ref, computed } from 'vue';
import aiService from '../js/aiService.js';
import utilFunctions from '../js/util.js';

export function useChat(inputMessage, isTableContextAttached) {
  const isLoading = ref(false);
  const messages = ref([]);

  const hasStreamingMessage = computed(() => {
    return messages.value.some(message => message.isStreaming);
  });

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
  
  const extractJsonFromText = (text) => {
    const options = []; 
    if (!text) return options; 

    const regex = /```json\s*([\s\S]*?)\s*```/g; 
    let match;
    while ((match = regex.exec(text)) !== null) {
        if (match[1]) { 
            try {
                const parsedOption = JSON.parse(match[1]);
                options.push(parsedOption);
            } catch (e) {
                console.error("[useChat] extractJsonFromText: 解析图表JSON失败:", e, "\n原始JSON字符串:", match[1]);
                addSystemMessage("⚠️ AI返回的部分图表配置解析失败。");
            }
        }
    }
    return options; 
  }

  const sendMessage = async () => {
    if (!inputMessage.value.trim() || isLoading.value) return;

    const userMessageContent = inputMessage.value.trim();
    addUserMessage(userMessageContent);
    inputMessage.value = '';
    isLoading.value = true;

    let messageToSendToAI = userMessageContent;
    let actualTableDataUsed = false;

    if (isTableContextAttached.value) {
      try {
        if (typeof wps === 'undefined' || !wps.EtApplication) {
          addSystemMessage('⚠️ WPS JSAPI 环境不可用，无法获取表格数据。');
        } else {
          const currentTableMarkdown = utilFunctions.getTableContextDataAsMarkdown();
          if (currentTableMarkdown && currentTableMarkdown.trim() !== '') {
            messageToSendToAI = `请参考以下表格数据：\n${currentTableMarkdown}\n\n针对以上数据，我的问题是：\n${userMessageContent}`;
            actualTableDataUsed = true;
          } else {
            addSystemMessage('⚠️ 未能获取到有效的表格数据（或所选区域为空）。');
          }
        }
      } catch (error) {
        console.error("发送时获取表格数据出错:", error);
        addSystemMessage(`❌ 获取表格数据失败: ${error.message}。`);
      }
    }

    const chartKeywords = ['图表', '可视化', '柱状图', '折线图', '饼图', '趋势', '分布', '占比', '生成图', '画图', '条形图', '散点图', '面积图', '雷达图', '热力图', 'K线图', '箱线图', '绘制', '展现', '统计图'];
    const isChartRequest = chartKeywords.some(keyword => userMessageContent.toLowerCase().includes(keyword.toLowerCase()));
    let finalSystemPrompt = '你是一个友好、专业的AI助手，可以帮助用户解答各种问题，提供建议和帮助。请用中文回答。';

    if (isChartRequest && actualTableDataUsed) {
        finalSystemPrompt = `你是一个数据可视化助手。用户提供了Markdown格式的表格数据和图表生成请求。
请执行以下操作：
1. 分析数据和用户要求。
2. 如果用户没有明确指定图表类型，请根据数据特征判断最适合的ECharts图表类型（例如：折线图、柱状图、饼图、散点图等）。
3. 生成一个完整的、可以直接在ECharts中使用的option JSON对象。确保JSON格式正确无误。
4. 在你的文字回复中，可以简要说明你选择的图表类型（如果是由你推荐的）以及图表所展示的主要内容。
请将ECharts option JSON对象包裹在 \`\`\`json 和 \`\`\` 之间。
**重要：生成的JSON对象必须是纯粹的数据结构，绝对不能包含任何JavaScript函数、回调函数或任何形式的可执行代码。如果某个配置项（如tooltip的formatter、label的formatter等）通常使用函数，请尝试使用ECharts支持的字符串模板变量，或者直接省略该formatter配置，以确保输出是严格合法的JSON。**`;
    }

    const aiMessageIndex = messages.value.length;
    addMessage('ai', '', { isStreaming: true, fullContent: '', chartOptions: null });

    try {
      await new Promise((resolve, reject) => {
        aiService.callQwenAPIStream(
          messageToSendToAI,
          finalSystemPrompt,
          (chunk, content) => {
            if (messages.value[aiMessageIndex]) {
              updateMessageContent(aiMessageIndex, content);
            }
          },
          (finalContent) => {
            if (messages.value[aiMessageIndex]) {
              const msg = messages.value[aiMessageIndex];
              msg.content = finalContent;
              msg.fullContent = finalContent;
              msg.isStreaming = false;
              if (isChartRequest) {
                msg.chartOptions = extractJsonFromText(finalContent);
              }
            }
            isLoading.value = false;
            resolve(finalContent);
          },
          (error) => {
            reject(error);
          }
        );
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('AI请求被用户中止。');
        if (messages.value[aiMessageIndex]) {
          messages.value[aiMessageIndex].isStreaming = false;
        }
      } else {
        console.error('AI对话失败:', error);
        if (messages.value[aiMessageIndex]) {
          messages.value[aiMessageIndex].content = `❌ 抱歉，处理您的问题时出现错误：${error.message}`;
          messages.value[aiMessageIndex].isStreaming = false;
        }
      }
      isLoading.value = false;
    }
  };

  const stopProcessing = () => {
    if (aiService && typeof aiService.stop === 'function') {
      aiService.stop();
    }
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

  return {
    isLoading,
    messages,
    hasStreamingMessage,
    addSystemMessage,
    sendMessage,
    stopProcessing,
    clearChat,
  };
}
