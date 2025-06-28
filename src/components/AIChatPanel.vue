<template>
  <div class="ai-chat-panel">
    <ChatHeader 
      :has-api-key="hasApiKey"
      :is-expanded="isExpanded"
      @show-config="showConfigPanel = !showConfigPanel"
      @toggle-panel="togglePanel"
      @clear-chat="clearChat"
    />

    <div v-if="showConfigPanel" class="config-panel-container">
      <LLMConfigPanel @config-changed="onConfigChanged" />
    </div>

    <div class="chat-body" v-show="isExpanded">
      <div v-if="!hasApiKey" class="api-setup-prompt">
        <div class="prompt-content">
          <p>🔑 请先设置API Key</p>
          <button @click="showApiKeyDialog" class="setup-btn">设置API Key</button>
        </div>
      </div>

      <div v-else class="chat-content">
        <MessageList
          :messages="messages"
          :is-loading="isLoading"
          :has-streaming-message="hasStreamingMessage"
        />
        <UserInput
          v-model="inputMessage"
          :is-loading="isLoading"
          :is-table-context-attached="isTableContextAttached"
          :is-loading-dynamic-prompts="isLoadingDynamicPrompts"
          :dynamic-prompts="dynamicPrompts"
          :is-agent-mode="isAgentMode"
          @submit="submitMessage"
          @toggle-agent-mode="isAgentMode = !isAgentMode"
          @toggle-table-context="toggleTableContext"
          @stop="stopProcessing"
          @quick-prompt="handleQuickPromptClick"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch, computed } from 'vue'
import aiService from './js/aiService.js'
import utilFunctions from './js/util.js'
import LLMConfigPanel from './LLMConfigPanel.vue'
import appConfigManager from './js/appConfigManager.js'
import ChatHeader from './ChatHeader.vue'
import MessageList from './MessageList.vue'
import UserInput from './UserInput.vue'
import { useAgent } from './js/useAgent.js'

export default {
  name: 'AIChatPanel',
  components: {
    LLMConfigPanel,
    ChatHeader,
    MessageList,
    UserInput,
  },
  setup() {
    const hasApiKey = ref(false)
    const isExpanded = ref(true) 
    const inputMessage = ref('')
    const messages = ref([])
    const showConfigPanel = ref(false)
    const isTableContextAttached = ref(false) 
    const isAgentMode = ref(true);

    const isLoadingDynamicPrompts = ref(false);
    const dynamicPrompts = ref([]);

    const addUserMessage = (content) => {
      messages.value.push({
        type: 'user',
        content: content,
        time: new Date().toLocaleTimeString()
      })
    };

    const addSystemMessage = (content, title) => {
      const message = {
        id: Date.now() + Math.random(),
        type: 'system',
        title: title || '系统消息',
        content: content,
        time: new Date().toLocaleTimeString(),
        isCollapsed: false,
        isStreaming: false,
      };
      messages.value.push(message);
      return message;
    };

    const { isLoading: isAgentLoading, startDataAnalysis: runAgent } = useAgent(messages, addUserMessage, addSystemMessage);
    const isLoading = computed(() => isAgentLoading.value);
    
    const hasStreamingMessage = computed(() => {
      return messages.value.some(message => message.isStreaming)
    });

    const submitMessage = () => {
      if (isAgentMode.value) {
        runAgent(inputMessage.value, isTableContextAttached.value);
      } else {
        sendMessage();
      }
      inputMessage.value = '';
    };

    const handleQuickPromptClick = (promptText) => {
      if (isLoading.value || isLoadingDynamicPrompts.value) return;
      inputMessage.value = promptText;
      submitMessage();
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
          addSystemMessage('ℹ️ 未能获取表格数据用于动态推荐快捷指令。', '系统提示');
          isLoadingDynamicPrompts.value = false;
          return;
        }
        
        const headers = utilFunctions.extractHeadersFromMarkdown(tableMarkdown);
        if (!headers || headers.length === 0) {
          addSystemMessage('ℹ️ 未能从表格中提取表头信息。', '系统提示');
          isLoadingDynamicPrompts.value = false;
          return;
        }
        
        const systemMessageForSuggestions = "你是一个乐于助人的助手，专门为用户推荐针对表格数据的操作指令。请确保指令简洁、面向操作，并且与提供的表头高度相关。";
        const promptForDynamicSuggestions = `根据以下表格的表头信息: [${headers.join(', ')}]，请为用户推荐3到5个简洁的、可直接用于数据分析或可视化的操作指令。每个指令占一行，直接返回指令文本，不要包含任何序号、列表符号或者额外的解释性文字。`;
        
        addSystemMessage('🤖 正在根据当前表格内容生成智能建议...', '智能建议');
        const suggestionsString = await aiService.callQwenAPI(promptForDynamicSuggestions, systemMessageForSuggestions);

        if (suggestionsString && suggestionsString.trim()) {
          const suggestedPrompts = suggestionsString.split('\n').map(p => p.trim()).filter(p => p && p.length > 0 && p.length < 100).slice(0, 5);
          if (suggestedPrompts.length > 0) {
            dynamicPrompts.value = suggestedPrompts;
            addSystemMessage('✅ 已更新智能建议。', '智能建议');
          } else {
            addSystemMessage('ℹ️ AI未能提供有效的智能建议。', '智能建议');
          }
        } else {
          addSystemMessage('ℹ️ AI未能生成智能建议。', '智能建议');
        }
      } catch (error) {
        console.error("获取动态快捷指令失败:", error);
        addSystemMessage(`❌ 获取智能建议失败: ${error.message}`, '错误');
      } finally {
        isLoadingDynamicPrompts.value = false;
      }
    };

    const toggleTableContext = async () => {
      isTableContextAttached.value = !isTableContextAttached.value;
      if (isTableContextAttached.value) {
        addSystemMessage('✅ 表格数据引用已激活。正在尝试获取表格信息以生成智能建议...', '表格引用');
        await fetchAndSetDynamicQuickPrompts();
      } else {
        dynamicPrompts.value = []; 
        addSystemMessage('ℹ️ 已取消表格数据引用。下次发送将不包含表格数据。', '表格引用');
      }
    };

    const checkApiKeyStatus = () => {
      const currentLlm = appConfigManager.getCurrentLlmConfig()
      hasApiKey.value = !!(currentLlm && currentLlm.apiKey)
    };

    const onConfigChanged = (newConfig) => {
      checkApiKeyStatus()
      showConfigPanel.value = false
      if (newConfig && newConfig.apiKey) {
        addSystemMessage(`✅ 已切换到配置：${newConfig.name}，现在可以开始对话了。`, '配置更新')
        if(isTableContextAttached.value) {
          fetchAndSetDynamicQuickPrompts();
        }
      }
    };

    const togglePanel = () => {
      isExpanded.value = !isExpanded.value
    };

    const showApiKeyDialog = () => {
      const currentLlm = appConfigManager.getCurrentLlmConfig();
      if (!currentLlm) {
        addSystemMessage('⚠️ 当前没有活动的LLM配置。请先通过设置面板选择或创建一个配置。', '配置错误');
        showConfigPanel.value = true; 
        return;
      }

      const promptMessage = `请输入配置 "${currentLlm.name}" 的 API Key：`;
      const newKey = prompt(promptMessage, currentLlm.apiKey || '');

      if (newKey !== null) { 
        if (newKey.trim()) {
          try {
            appConfigManager.updateLlmConfig(currentLlm.id, { apiKey: newKey.trim() });
            checkApiKeyStatus(); 
            addSystemMessage(`✅ API Key已为配置 "${currentLlm.name}" 更新。`, '配置更新');
            if(hasApiKey.value) {
                 addSystemMessage('现在可以开始对话了。', '系统消息');
            }
          } catch (error) {
            console.error("更新API Key失败:", error);
            addSystemMessage(`❌ 更新API Key失败: ${error.message}`, '错误');
          }
        } else {
           try {
            appConfigManager.updateLlmConfig(currentLlm.id, { apiKey: '' });
            checkApiKeyStatus();
            addSystemMessage(`ℹ️ API Key已为配置 "${currentLlm.name}" 清除。`, '配置更新');
          } catch (error) {
            console.error("清除API Key失败:", error);
            addSystemMessage(`❌ 清除API Key失败: ${error.message}`, '错误');
          }
        }
      }
    };

    const clearChat = () => {
      if (confirm('确定要清空所有对话记录吗？')) {
        messages.value = [];
      }
    };

    const sendMessage = async () => {
      if (!inputMessage.value.trim()) return;

      let userMessageContent = inputMessage.value
      addUserMessage(userMessageContent) 
      inputMessage.value = ''
      isLoading.value = true

      let messageToSendToAI = userMessageContent;
      
      if (isTableContextAttached.value) {
        try {
          const currentTableMarkdown = utilFunctions.getTableContextDataAsMarkdown();
          if (currentTableMarkdown && currentTableMarkdown.trim() !== '') {
            messageToSendToAI = `请参考以下表格数据：\n${currentTableMarkdown}\n\n针对以上数据，我的问题是：\n${userMessageContent}`;
          } else {
            addSystemMessage('⚠️ 未能获取到有效的表格数据（或所选区域为空）。', '数据错误');
          }
        } catch (error) {
          console.error("发送时获取表格数据出错:", error);
          addSystemMessage(`❌ 获取表格数据失败: ${error.message}。`, '错误');
        }
      }
      
      let finalSystemPrompt = '你是一个友好、专业的AI助手，可以帮助用户解答各种问题，提供建议和帮助。请用中文回答。';

      const aiMessageIndex = messages.value.length
      messages.value.push({
        type: 'ai',
        content: '',
        time: new Date().toLocaleTimeString(),
        isStreaming: true,
        fullContent: ''
      })

      try {
        aiService.callQwenAPIStream(
          messageToSendToAI, 
          finalSystemPrompt, 
          (chunk, accumulatedContent) => {
            if (messages.value[aiMessageIndex]) {
              messages.value[aiMessageIndex].content = accumulatedContent;
            }
          },
          (finalContent) => {
            if (messages.value[aiMessageIndex]) {
              messages.value[aiMessageIndex].isStreaming = false;
            }
            isLoading.value = false;
          },
          (error) => {
            console.error('AI对话失败:', error);
            if (messages.value[aiMessageIndex]) {
              messages.value[aiMessageIndex].content = `❌ 抱歉，处理您的问题时出现错误：${error.message}`;
              messages.value[aiMessageIndex].isStreaming = false;
            }
            isLoading.value = false; 
          }
        )
      } catch (error) {
        // This catch block might be redundant if the error callback handles everything.
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
      addSystemMessage('⏹️ 已停止当前AI处理请求。', '系统消息');
    };

    onMounted(() => {
      checkApiKeyStatus(); 
    });

    watch(() => appConfigManager.getCurrentLlmConfig()?.apiKey, (newApiKey, oldApiKey) => {
        if (newApiKey !== oldApiKey) {
            checkApiKeyStatus();
        }
    }, { immediate: false }); 

    return {
      hasApiKey,
      isExpanded,
      isLoading,
      inputMessage,
      messages,
      showConfigPanel,
      isTableContextAttached,
      isLoadingDynamicPrompts,
      dynamicPrompts,
      hasStreamingMessage,
      isAgentMode,
      toggleTableContext,
      onConfigChanged,
      togglePanel,
      showApiKeyDialog,
      clearChat,
      submitMessage,
      stopProcessing,
      handleQuickPromptClick,
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
</style>
