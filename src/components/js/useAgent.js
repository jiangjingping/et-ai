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
        
        let currentRoundMessage = messages.value.find(m => m.type === 'agent_round' && m.roundNumber === progress.round);

        if (!currentRoundMessage && progress.type === 'llm_start') {
          currentRoundMessage = addSystemMessage('', `🔄 Round ${progress.round}: Thinking...`);
          currentRoundMessage.type = 'agent_round';
          currentRoundMessage.roundNumber = progress.round;
          currentRoundMessage.steps = [];
        }
        
        if (currentRoundMessage) {
            switch(progress.type) {
                case 'llm_stream':
                    const thoughtStep = currentRoundMessage.steps.find(s => s.type === 'thought');
                    if (thoughtStep) {
                        thoughtStep.content += progress.content;
                    }
                    break;
                case 'llm_thought':
                    currentRoundMessage.steps.push({ type: 'thought', content: progress.content });
                    break;
                case 'code_start':
                    currentRoundMessage.steps.push({ type: 'code', content: progress.content, result: 'Executing...' });
                    break;
                case 'code_end':
                    const codeStep = currentRoundMessage.steps.find(s => s.type === 'code' && s.result === 'Executing...');
                    if (codeStep) {
                        codeStep.result = `\`\`\`json\n${progress.content}\n\`\`\``;
                    }
                    break;
                case 'error':
                    const failedCodeStep = currentRoundMessage.steps.find(s => s.type === 'code' && s.result === 'Executing...');
                    if (failedCodeStep) {
                        failedCodeStep.result = `❌ **Error**:\n\`\`\`\n${progress.content}\n\`\`\``;
                    } else {
                         currentRoundMessage.steps.push({ type: 'error', content: progress.content });
                    }
                    break;
            }
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
