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
                    let thoughtStep = currentRoundMessage.steps.find(s => s.type === 'thought');
                    if (!thoughtStep) {
                        thoughtStep = { type: 'thought', content: '' };
                        currentRoundMessage.steps.push(thoughtStep);
                    }
                    thoughtStep.content = progress.accumulatedContent;
                    break;
                case 'llm_thought':
                    currentRoundMessage.steps.push({ type: 'thought', content: progress.content });
                    break;
                case 'code_start':
                    currentRoundMessage.steps.push({ type: 'code', content: progress.content, result: { summary: 'Executing...', details: null, isError: false } });
                    break;
                case 'code_end':
                    const codeStep = currentRoundMessage.steps.find(s => s.type === 'code' && s.result.summary === 'Executing...');
                    if (codeStep) {
                        codeStep.result = {
                            summary: '✅ 执行成功',
                            details: progress.content, // Raw JSON string
                            isError: false
                        };
                    }
                    break;
                case 'error':
                    const failedCodeStep = currentRoundMessage.steps.find(s => s.type === 'code' && s.result.summary === 'Executing...');
                    if (failedCodeStep) {
                        failedCodeStep.result = {
                            summary: '❌ 执行失败',
                            details: progress.content, // Error message
                            isError: true
                        };
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
