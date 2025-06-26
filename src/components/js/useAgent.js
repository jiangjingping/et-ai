import { ref } from 'vue';
import { JsDataAnalysisAgent } from '../../js-data-analysis-agent/core/JsDataAnalysisAgent.js';
import utilFunctions from './util.js';

export function useAgent(messages, addUserMessage, addSystemMessage) {
  const isLoading = ref(false);

  const startDataAnalysis = async (userQuery, isTableContextAttached) => {
    if (!userQuery) {
      addSystemMessage('⚠️ 请在输入框中输入您的分析请求。', '提示');
      return;
    }
    if (!isTableContextAttached) {
        addSystemMessage('⚠️ 请先使用“引用表格”按钮引用表格数据。', '提示');
        return;
    }

    addUserMessage(userQuery);
    isLoading.value = true;
    addSystemMessage('🚀 正在启动数据分析代理...', '启动分析');

    try {
      const tableData = utilFunctions.getTableContextDataAsJson();
      if (!tableData || tableData.length === 0) {
        addSystemMessage('❌ 无法从表格中检索到有效数据。', '错误');
        isLoading.value = false;
        return;
      }

      const agent = new JsDataAnalysisAgent();
      const onProgress = (progress) => {
        console.log("AGENT: progress update:", progress);
        let title = '系统消息';
        let content = progress.content;
        
        const lastMessage = messages.value.length > 0 ? messages.value[messages.value.length - 1] : null;

        switch(progress.type) {
          case 'llm_start':
            title = `🧠 ${progress.content}`;
            if (lastMessage && lastMessage.isStreaming) lastMessage.isStreaming = false;
            addSystemMessage('正在调用大语言模型...', title).isStreaming = true;
            break;
          case 'code_start':
            title = `⚡ 执行代码`;
            if (lastMessage && lastMessage.isStreaming) lastMessage.isStreaming = false;
            addSystemMessage('沙箱环境准备执行代码...', title).isStreaming = true;
            break;
          case 'code_end':
            if (lastMessage && lastMessage.type === 'system' && lastMessage.title.startsWith('⚡')) {
               lastMessage.content = `\`\`\`json\n${progress.content}\n\`\`\``;
               lastMessage.isStreaming = false;
            }
            break;
          case 'error':
             if (lastMessage && lastMessage.type === 'system' && lastMessage.title.startsWith('⚡')) {
              lastMessage.content = `❌ **错误**:\n\`\`\`\n${progress.content}\n\`\`\``;
              lastMessage.isStreaming = false;
            } else {
              addSystemMessage(`❌ **错误**:\n\`\`\`\n${progress.content}\n\`\`\``, '错误');
            }
            break;
          case 'plot':
          case 'complete':
            if (lastMessage && lastMessage.isStreaming) {
              lastMessage.isStreaming = false;
            }
            break;
          default:
            addSystemMessage(content, title);
        }
      };

      const result = await agent.analyze(userQuery, tableData, onProgress);
      
      if (result.plotSpec) {
          messages.value.push({
              type: 'ai',
              content: '这是您请求的图表：',
              time: new Date().toLocaleTimeString(),
              plotSpec: result.plotSpec
          });
      } else {
           messages.value.push({
              type: 'ai',
              content: `✅ ${result.report}`,
              time: new Date().toLocaleTimeString()
          });
      }

    } catch (error) {
      console.error("数据分析代理失败:", error);
      addSystemMessage(`❌ 数据分析失败: ${error.message}`, '严重错误');
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isLoading,
    startDataAnalysis,
  };
}
