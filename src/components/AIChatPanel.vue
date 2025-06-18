<template>
  <div class="ai-chat-panel">
    <!-- 头部区域 -->
    <ChatHeader 
      :has-api-key="hasApiKey" 
      :is-expanded="isExpanded"
      @toggle-config="showConfigPanel = !showConfigPanel"
      @toggle-panel="togglePanel"
      @clear-chat="clearChat"
    />

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
        <!-- 消息列表 -->
        <ChatMessageList
          :messages="messages"
          :is-loading="isLoading"
          :has-streaming-message="hasStreamingMessage"
        />

        <!-- 输入区域 -->
        <ChatInput
          v-model="inputMessage"
          :is-loading="isLoading"
          :is-loading-dynamic-prompts="isLoadingDynamicPrompts"
          :is-table-context-attached="isTableContextAttached"
          :analysis-prompts="analysisPrompts"
          :visualization-prompts="visualizationPrompts"
          :dynamic-prompts="dynamicPrompts"
          @send-message="sendMessage"
          @stop-processing="stopProcessing"
          @toggle-table-context="toggleTableContext"
          @quick-prompt-click="handleQuickPromptClick"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue'
import LLMConfigPanel from './LLMConfigPanel.vue'
import ChatHeader from './chat/ChatHeader.vue'
import ChatInput from './chat/ChatInput.vue'
import ChatMessageList from './chat/ChatMessageList.vue'
import appConfigManager from './js/appConfigManager.js'
import { useChat } from './composables/useChat.js'
import { useQuickPrompts } from './composables/useQuickPrompts.js'

export default {
  name: 'AIChatPanel',
  components: {
    LLMConfigPanel,
    ChatHeader,
    ChatInput,
    ChatMessageList
  },
  setup() {
    const hasApiKey = ref(false)
    const isExpanded = ref(true) 
    const inputMessage = ref('')
    const showConfigPanel = ref(false)
    const isTableContextAttached = ref(false) 

    const { 
      isLoading, 
      messages, 
      hasStreamingMessage, 
      addSystemMessage, 
      sendMessage, 
      stopProcessing, 
      clearChat 
    } = useChat(inputMessage, isTableContextAttached);

    const {
      isLoadingDynamicPrompts,
      analysisPrompts,
      visualizationPrompts,
      dynamicPrompts,
      handleQuickPromptClick,
      toggleTableContext,
      fetchAndSetDynamicQuickPrompts
    } = useQuickPrompts(inputMessage, isTableContextAttached, addSystemMessage, sendMessage);

    const checkApiKeyStatus = () => {
      const currentLlm = appConfigManager.getCurrentLlmConfig()
      hasApiKey.value = !!(currentLlm && currentLlm.apiKey)
    }

    const onConfigChanged = (newConfig) => {
      checkApiKeyStatus()
      showConfigPanel.value = false
      if (newConfig && newConfig.apiKey) {
        addSystemMessage(`✅ 已切换到配置：${newConfig.name}，现在可以开始对话了。`)
        if(isTableContextAttached.value) {
          fetchAndSetDynamicQuickPrompts();
        }
      }
    }

    const togglePanel = () => {
      isExpanded.value = !isExpanded.value
    }

    const showApiKeyDialog = () => {
      const currentLlm = appConfigManager.getCurrentLlmConfig();
      if (!currentLlm) {
        addSystemMessage('⚠️ 当前没有活动的LLM配置。请先通过设置面板选择或创建一个配置。');
        showConfigPanel.value = true; 
        return;
      }

      const promptMessage = `请输入API Key для配置 "${currentLlm.name}":`;
      const newKey = prompt(promptMessage, currentLlm.apiKey || '');

      if (newKey !== null) { 
        if (newKey.trim()) {
          try {
            appConfigManager.updateLlmConfig(currentLlm.id, { apiKey: newKey.trim() });
            checkApiKeyStatus(); 
            addSystemMessage(`✅ API Key已为配置 "${currentLlm.name}" 更新。`);
            if(hasApiKey.value) {
                 addSystemMessage('现在可以开始对话了。');
            }
          } catch (error) {
            console.error("更新API Key失败:", error);
            addSystemMessage(`❌ 更新API Key失败: ${error.message}`);
          }
        } else {
           try {
            appConfigManager.updateLlmConfig(currentLlm.id, { apiKey: '' });
            checkApiKeyStatus();
            addSystemMessage(`ℹ️ API Key已为配置 "${currentLlm.name}" 清除。`);
          } catch (error) {
            console.error("清除API Key失败:", error);
            addSystemMessage(`❌ 清除API Key失败: ${error.message}`);
          }
        }
      }
    }

    onMounted(() => {
      checkApiKeyStatus(); 
    })

    watch(() => appConfigManager.getCurrentLlmConfig()?.apiKey, (newApiKey, oldApiKey) => {
        if (newApiKey !== oldApiKey) {
            checkApiKeyStatus();
        }
    }, { immediate: false }); 

    return {
      hasApiKey,
      isExpanded,
      isLoading,
      isLoadingDynamicPrompts,
      inputMessage,
      messages,
      hasStreamingMessage,
      showConfigPanel,
      isTableContextAttached,
      toggleTableContext,
      analysisPrompts,
      visualizationPrompts,
      dynamicPrompts,
      handleQuickPromptClick,
      togglePanel,
      showApiKeyDialog,
      clearChat,
      sendMessage,
      stopProcessing,
      onConfigChanged,
      addSystemMessage
    }
  }
}
</script>

<style scoped>
.ai-chat-panel {
  height: 100vh;
  width: 100%;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.ai-chart-display {
  margin-top: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.charts-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.config-panel-container {
  border-bottom: 1px solid #e1e5e9;
  background: #f8f9fa;
}

.chat-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.api-setup-prompt {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.prompt-content {
  text-align: center;
}

.setup-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
}

.chat-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@keyframes loading {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
</style>
