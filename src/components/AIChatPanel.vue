<template>
  <div class="ai-chat-panel">
    <!-- 头部区域 -->
    <div class="chat-header">
      <!-- ... header content ... -->
    </div>

    <!-- LLM配置面板 -->
    <div v-if="showConfigPanel" class="config-panel-container">
      <LLMConfigPanel @config-changed="onConfigChanged" />
    </div>

    <!-- 主体内容区域 -->
    <div class="chat-body" v-show="isExpanded">
      <!-- API Key 设置提示 -->
      <div v-if="!hasApiKey" class="api-setup-prompt">
        <div class="prompt-content">
          <p>🔑 请先设置API Key</p>
          <button @click="showApiKeyDialog" class="setup-btn">设置API Key</button>
        </div>
      </div>

      <!-- 对话区域 -->
      <div v-else class="chat-content">
        <div class="messages-container" ref="messagesContainer">
          <!-- ... welcome-message ... -->
          <div v-for="(message, index) in messages" :key="index" class="message" :class="message.type">
            <div class="message-content">
              <div class="message-header">
                <span class="sender">{{ message.type === 'user' ? '👤 您' : '🤖 AI助手' }}</span>
                <span class="time">{{ message.time }}</span>
                <span v-if="message.isStreaming" class="streaming-indicator">正在输入...</span>
              </div>
              <!-- Standard message text -->
              <div v-if="!message.isAnalysis" class="message-text" v-html="formatMessage(message.content)"></div>
              
              <!-- Data Analysis Agent Results -->
              <div v-if="message.isAnalysis" class="analysis-results">
                <div v-for="(result, r_index) in message.analysisSteps" :key="r_index" class="result-item">
                  <details>
                    <summary>第 {{ result.round }} 轮分析</summary>
                    <pre class="code-block"><code>{{ result.code }}</code></pre>
                  </details>
                  <div v-if="isEchartsOption(result.result)" class="chart-container">
                    <v-chart :option="result.result" autoresize />
                  </div>
                </div>
                <div class="final-report">
                  <h4>最终报告</h4>
                  <div v-html="formatMessage(message.content)"></div>
                </div>
              </div>

              <div v-if="message.isStreaming && message.content" class="streaming-cursor">▋</div>
            </div>
          </div>
          <!-- ... loading indicator ... -->
        </div>
        <!-- ... input-area ... -->
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, nextTick, watch, computed } from 'vue';
import aiService from './js/aiService.js';
import utilFunctions from './js/util.js';
import { renderMarkdown } from './js/markdownRenderer.js';
import LLMConfigPanel from './LLMConfigPanel.vue';
import appConfigManager from './js/appConfigManager.js';
import { DataAnalysisAgent } from '../js-data-analysis-agent/core/DataAnalysisAgent.js';

// ECharts components
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, GridComponent, LegendComponent } from 'echarts/components';

use([CanvasRenderer, BarChart, LineChart, PieChart, TitleComponent, TooltipComponent, GridComponent, LegendComponent]);

export default {
  name: 'AIChatPanel',
  components: {
    LLMConfigPanel,
    VChart,
  },
  setup() {
    const hasApiKey = ref(false);
    const isExpanded = ref(true);
    const isLoading = ref(false);
    const inputMessage = ref('');
    const messages = ref([]);
    const messagesContainer = ref(null);
    const showConfigPanel = ref(false);
    const isTableContextAttached = ref(false);
    
    const dataAgent = new DataAnalysisAgent();

    // ... (other existing setup code like dynamic prompts, etc.)

    const isEchartsOption = (obj) => {
      return obj && typeof obj === 'object' && obj.series && Array.isArray(obj.series);
    };

    const sendMessage = async () => {
      if (!inputMessage.value.trim() || isLoading.value) return;

      const userMessageContent = inputMessage.value.trim();
      addUserMessage(userMessageContent);
      inputMessage.value = '';
      isLoading.value = true;

      const analysisKeywords = ['分析', '图表', '可视化', '趋势', '占比', '分布'];
      const isAnalysisRequest = analysisKeywords.some(k => userMessageContent.includes(k)) && isTableContextAttached.value;

      if (isAnalysisRequest) {
        // --- Data Analysis Agent Workflow ---
        addSystemMessage('🤖 检测到数据分析请求，正在启动智能体...');
        try {
          const rawData = utilFunctions.getTableContextData(true); // Get raw data for agent
          if (!rawData || rawData.length === 0) {
            addSystemMessage('⚠️ 无法获取用于分析的表格数据。');
            isLoading.value = false;
            return;
          }
          
          const agentResult = await dataAgent.analyze(userMessageContent, rawData);
          
          messages.value.push({
            type: 'ai',
            content: agentResult.final_report,
            time: new Date().toLocaleTimeString(),
            isAnalysis: true,
            analysisSteps: agentResult.results,
          });
          scrollToBottom();

        } catch (error) {
          console.error('Data analysis agent failed:', error);
          addSystemMessage(`❌ 智能体分析失败: ${error.message}`);
        } finally {
          isLoading.value = false;
        }

      } else {
        // --- Standard Chat Workflow ---
        let messageToSendToAI = userMessageContent;
        if (isTableContextAttached.value) {
          const tableMarkdown = utilFunctions.getTableContextData(false); // Get markdown for chat
          if (tableMarkdown) {
            messageToSendToAI = `请参考以下表格数据：\n${tableMarkdown}\n\n针对以上数据，我的问题是：\n${userMessageContent}`;
          }
        }
        
        const aiMessageIndex = messages.value.length;
        messages.value.push({
          type: 'ai',
          content: '',
          time: new Date().toLocaleTimeString(),
          isStreaming: true,
        });
        scrollToBottom();

        try {
          await aiService.callQwenAPIStream(
            messageToSendToAI,
            '你是一个友好、专业的AI助手，可以帮助用户解答各种问题，提供建议和帮助。请用中文回答。',
            (chunk, content) => {
              if (messages.value[aiMessageIndex]) {
                messages.value[aiMessageIndex].content = content;
                scrollToBottom();
              }
            },
            (finalContent) => {
              if (messages.value[aiMessageIndex]) {
                messages.value[aiMessageIndex].isStreaming = false;
              }
              isLoading.value = false;
            },
            (error) => {
              throw error;
            }
          );
        } catch (error) {
          console.error('AI对话失败:', error);
          if (messages.value[aiMessageIndex]) {
            messages.value[aiMessageIndex].content = `❌ 抱歉，处理您的问题时出现错误：${error.message}`;
            messages.value[aiMessageIndex].isStreaming = false;
          }
          isLoading.value = false;
        }
      }
    };

    // ... (rest of the setup function: addUserMessage, addSystemMessage, formatMessage, etc.)
    // Make sure to add `isEchartsOption` to the return object.

    const addUserMessage = (content) => {
      messages.value.push({
        type: 'user',
        content: content,
        time: new Date().toLocaleTimeString()
      })
      scrollToBottom()
    }

    const addSystemMessage = (content) => {
      messages.value.push({
        type: 'system',
        content: content,
        time: new Date().toLocaleTimeString()
      })
      scrollToBottom()
    }

    const scrollToBottom = () => {
      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
      })
    }
    
    const formatMessage = (content) => {
      if (!content) return '';
      return renderMarkdown(content);
    }

    // ... (other existing setup code)
    const checkApiKeyStatus = () => {
      const currentLlm = appConfigManager.getCurrentLlmConfig()
      hasApiKey.value = !!(currentLlm && currentLlm.apiKey)
    }

    const onConfigChanged = (newConfig) => {
      checkApiKeyStatus()
      showConfigPanel.value = false
      if (newConfig && newConfig.apiKey) {
        addSystemMessage(`✅ 已切换到配置：${newConfig.name}，现在可以开始对话了。`)
      }
    }

    const togglePanel = () => {
      isExpanded.value = !isExpanded.value
    }

    const showApiKeyDialog = () => {
      // ...
    }

    const clearChat = () => {
      if (confirm('确定要清空所有对话记录吗？')) {
        messages.value = [];
      }
    }
    
    const stopProcessing = () => {
      // ...
    }

    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault()
        sendMessage()
      }
    }
    
    const toggleTableContext = () => {
      isTableContextAttached.value = !isTableContextAttached.value;
      if (isTableContextAttached.value) {
        addSystemMessage('✅ 表格数据引用已激活。');
      } else {
        addSystemMessage('ℹ️ 已取消表格数据引用。');
      }
    }

    onMounted(() => {
      checkApiKeyStatus();
    });

    return {
      hasApiKey,
      isExpanded,
      isLoading,
      inputMessage,
      messages,
      messagesContainer,
      showConfigPanel,
      isTableContextAttached,
      toggleTableContext,
      togglePanel,
      showApiKeyDialog,
      clearChat,
      sendMessage,
      stopProcessing,
      handleKeyDown,
      formatMessage,
      onConfigChanged,
      isEchartsOption,
      // ... other returned refs and functions
    };
  }
};
</script>

<style scoped>
/* ... existing styles ... */
.analysis-results {
  padding: 10px;
  background-color: #f9f9f9;
  border-radius: 6px;
}
.result-item {
  margin-bottom: 15px;
  border-bottom: 1px dashed #ddd;
  padding-bottom: 15px;
}
.result-item:last-child {
  border-bottom: none;
}
.code-block {
  background-color: #f4f4f4;
  padding: 10px;
  white-space: pre-wrap;
  word-wrap: break-word;
  border-radius: 4px;
  font-size: 12px;
}
.chart-container {
  height: 350px;
  width: 100%;
  margin-top: 10px;
}
.final-report {
  margin-top: 15px;
}
</style>
