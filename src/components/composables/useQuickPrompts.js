import { ref } from 'vue';
import aiService from '../js/aiService.js';
import utilFunctions from '../js/util.js';

export function useQuickPrompts(inputMessage, isTableContextAttached, addSystemMessage, sendMessage) {
  const isLoadingDynamicPrompts = ref(false);

  // 🤖 通用问答指令 (general_qa)
  const generalQAPrompts = Object.freeze([
    "你好，请介绍一下你的功能",
    "什么是数据分析？",
    "如何进行有效的数据可视化？",
    "解释一下相关性分析的概念",
    "数据清洗的重要性是什么？"
  ]);

  // 💬 表格问答指令 (table_qa)
  const tableQAPrompts = Object.freeze([
    "这个表格有多少行数据？",
    "总结一下表格的主要内容",
    "表格中有哪些列？",
    "数据的时间范围是什么？",
    "找出表格中的最大值和最小值"
  ]);

  // 📊 简易图表指令 (simple_chart)
  const simpleChartPrompts = Object.freeze([
    "制作一个柱状图",
    "画个折线图显示趋势",
    "生成饼图显示占比",
    "创建散点图分析关系",
    "可视化这些数据"
  ]);

  // 🔬 高级分析指令 (advanced_analytics)
  const advancedAnalyticsPrompts = Object.freeze([
    "分析数据的相关性",
    "进行统计分析",
    "数据聚类分析",
    "预测数据趋势",
    "计算各变量间的相关关系"
  ]);

  const generalQA = ref([...generalQAPrompts]);
  const tableQA = ref([...tableQAPrompts]);
  const simpleChart = ref([...simpleChartPrompts]);
  const advancedAnalytics = ref([...advancedAnalyticsPrompts]);
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
                                    tableQA.value.includes(promptText) && (promptText.includes("表格") || promptText.includes("数据")) ||
                                    simpleChart.value.includes(promptText) ||
                                    advancedAnalytics.value.includes(promptText);

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
    generalQA,
    tableQA,
    simpleChart,
    advancedAnalytics,
    dynamicPrompts,
    handleQuickPromptClick,
    toggleTableContext,
    fetchAndSetDynamicQuickPrompts,
  };
}
