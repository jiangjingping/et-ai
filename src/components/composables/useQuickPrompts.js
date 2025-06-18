import { ref } from 'vue';
import aiService from '../js/aiService.js';
import utilFunctions from '../js/util.js';

export function useQuickPrompts(inputMessage, isTableContextAttached, addSystemMessage, sendMessage) {
  const isLoadingDynamicPrompts = ref(false);

  const defaultAnalysisPrompts = Object.freeze([
    "总结一下当前引用的表格",
    "解释这份数据的主要特点",
    "基于数据分析趋势",
    "找出数据中的异常值",
    "数据质量如何？"
  ]);
  const defaultVisualizationPrompts = Object.freeze([
    "帮我把这些数据可视化",
    "用折线图展示数据",
    "用饼图显示各部分占比",
    "创建柱状图比较数据",
    "生成散点图查看关联"
  ]);

  const analysisPrompts = ref([...defaultAnalysisPrompts]);
  const visualizationPrompts = ref([...defaultVisualizationPrompts]);
  const dynamicPrompts = ref([]);

  const extractHeadersFromMarkdown = (markdownTable) => {
    if (!markdownTable || typeof markdownTable !== 'string') return null;
    const lines = markdownTable.split('\n');
    if (lines.length < 1) return null;
    
    const headerLine = lines[0].trim();
    if (!headerLine.startsWith('|') || !headerLine.endsWith('|')) return null;

    const headers = headerLine.slice(1, -1).split('|').map(h => h.trim()).filter(h => h);
    return headers.length > 0 ? headers : null;
  };

  const fetchAndSetDynamicQuickPrompts = async () => {
    if (!isTableContextAttached.value) {
      dynamicPrompts.value = [];
      return;
    }
    isLoadingDynamicPrompts.value = true;
    dynamicPrompts.value = [];

    try {
      const tableMarkdown = utilFunctions.getTableContextDataAsMarkdown();
      if (!tableMarkdown || tableMarkdown.trim() === '') {
        addSystemMessage('ℹ️ 未能获取表格数据用于动态推荐快捷指令。');
        isLoadingDynamicPrompts.value = false;
        return;
      }

      const headers = extractHeadersFromMarkdown(tableMarkdown);
      if (!headers || headers.length === 0) {
        addSystemMessage('ℹ️ 未能从表格中提取表头信息。');
        isLoadingDynamicPrompts.value = false;
        return;
      }
      
      const systemMessageForSuggestions = "你是一个乐于助人的助手，专门为用户推荐针对表格数据的操作指令。请确保指令简洁、面向操作，并且与提供的表头高度相关。";
      const promptForDynamicSuggestions = `根据以下表格的表头信息: [${headers.join(', ')}]，请为用户推荐3到5个简洁的、可直接用于数据分析或可视化的操作指令。每个指令占一行，直接返回指令文本，不要包含任何序号、列表符号或者额外的解释性文字。`;
      
      addSystemMessage('🤖 正在根据当前表格内容生成智能建议...');
      const suggestionsString = await aiService.callQwenAPI(promptForDynamicSuggestions, systemMessageForSuggestions);

      if (suggestionsString && suggestionsString.trim()) {
        const suggestedPrompts = suggestionsString.split('\n').map(p => p.trim()).filter(p => p && p.length > 0 && p.length < 100).slice(0, 5);
        if (suggestedPrompts.length > 0) {
          dynamicPrompts.value = suggestedPrompts;
          addSystemMessage('✅ 已更新智能建议。');
        } else {
          addSystemMessage('ℹ️ AI未能提供有效的智能建议。');
        }
      } else {
        addSystemMessage('ℹ️ AI未能生成智能建议。');
      }
    } catch (error) {
      console.error("获取动态快捷指令失败:", error);
      addSystemMessage(`❌ 获取智能建议失败: ${error.message}`);
    } finally {
      isLoadingDynamicPrompts.value = false;
    }
  };

  const handleQuickPromptClick = (promptText) => {
    if (!isTableContextAttached.value) {
      const requiresDataContext = dynamicPrompts.value.includes(promptText) || 
                                    analysisPrompts.value.includes(promptText) && (promptText.includes("表格") || promptText.includes("数据")) ||
                                    visualizationPrompts.value.includes(promptText);

      if (requiresDataContext) {
          addSystemMessage('💡 此快捷指令可能需要引用表格数据。请先点击“引用表格”。');
      }
    }
    
    inputMessage.value = promptText;
    sendMessage();
  };

  const toggleTableContext = async () => {
    if (isTableContextAttached.value) {
      isTableContextAttached.value = false;
      dynamicPrompts.value = [];
      addSystemMessage('ℹ️ 已取消表格数据引用。下次发送将不包含表格数据。');
    } else {
      isTableContextAttached.value = true;
      addSystemMessage('✅ 表格数据引用已激活。正在尝试获取表格信息以生成智能建议...');
      await fetchAndSetDynamicQuickPrompts();
    }
  };

  return {
    isLoadingDynamicPrompts,
    isTableContextAttached,
    analysisPrompts,
    visualizationPrompts,
    dynamicPrompts,
    handleQuickPromptClick,
    toggleTableContext,
    fetchAndSetDynamicQuickPrompts,
  };
}
