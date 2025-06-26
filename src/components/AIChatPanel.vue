<template>
  <div class="ai-chat-panel">
    <!-- 头部区域 -->
    <div class="chat-header">
      <div class="header-content">
        <div class="title-section">
          <h3>🤖 AI智能助手</h3>
          <span class="status" :class="{ 'online': hasApiKey, 'offline': !hasApiKey }">
            {{ hasApiKey ? '在线' : '离线' }}
          </span>
        </div>
        <div class="header-actions">
          <button @click="showConfigPanel = !showConfigPanel" class="config-btn" title="LLM配置">
            ⚙️
          </button>
          <button @click="togglePanel" class="toggle-btn" :title="isExpanded ? '收起面板' : '展开面板'">
            {{ isExpanded ? '◀' : '▶' }}
          </button>
          <button @click="clearChat" class="clear-btn" title="清空对话">🗑️</button>
        </div>
      </div>
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
        <!-- 消息列表 -->
        <div class="messages-container" ref="messagesContainer">
          <div class="welcome-message" v-if="messages.length === 0">
            <div class="welcome-content">
              <h4>🤖 欢迎使用AI智能助手！</h4>
              <p>我可以协助您处理表格数据、生成可视化图表，并进行智能对话。请尝试以下操作：</p>
              <h5>📊 表格数据交互与可视化</h5>
              <ul>
                <li>点击输入框下方的“<strong>引用表格</strong>”按钮，选择您想分析的数据区域。</li>
                <li>然后，您可以尝试以下指令（或使用下方的快捷指令按钮）：
                  <ul>
                    <li>"总结一下这份表格"</li>
                    <li>"基于这些数据，分析销售趋势"</li>
                    <li>"帮我把这些数据可视化" (AI将尝试推荐合适的图表)</li>
                    <li>"用柱状图展示A列和B列的对比"</li>
                    <li>"生成每月销售额的折线图"</li>
                  </ul>
                </li>
                <li>如果AI返回了图表配置，图表将直接显示在对话中。</li>
              </ul>
              <h5>💬 通用AI能力</h5>
              <ul>
                <li><strong>文本处理</strong>：写作、翻译、总结、改写等。 (例如："帮我润色这段文字：...")</li>
                <li><strong>知识问答</strong>：解答各种问题。 (例如："WPS是什么时候发布的？")</li>
                <li><strong>创意与建议</strong>：获取灵感和方案。 (例如："给我三个关于市场推广的创意点子")</li>
              </ul>
              <div class="usage-tips">
                <p><strong>💡 快捷指令：</strong></p>
                <p>点击下方“快捷指令”按钮尝试！</p>
              </div>
            </div>
          </div>

          <!-- 消息列表 -->
          <div v-for="(message, index) in messages" :key="index" class="message" :class="message.type">
            <div class="message-content">
              <div class="message-header">
                <span class="sender">{{ message.type === 'user' ? '👤 您' : '🤖 AI助手' }}</span>
                <span class="time">{{ message.time }}</span>
                <span v-if="message.isStreaming" class="streaming-indicator">正在输入...</span>
              </div>
              <div class="message-text" v-if="!message.plotSpec" v-html="formatMessage(message.content)"></div>
              <div v-if="message.plotSpec" :ref="el => { if (message.plotSpec) plotContainer = el; }" class="plot-container"></div>
              <div v-if="message.isStreaming && message.content" class="streaming-cursor">▋</div>
            </div>
          </div>

          <div v-if="isLoading && !hasStreamingMessage" class="message ai loading">
            <div class="message-content">
              <div class="message-header">
                <span class="sender">🤖 AI助手</span>
                <span class="time">正在思考...</span>
              </div>
              <div class="loading-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        </div>

        <!-- 输入区域 -->
        <div class="input-area">
          <div 
            class="floating-quick-prompts-panel" 
            :class="{ 'expanded': isQuickPromptsPanelExpanded }"
            @mouseenter="onFloatingPromptsMouseEnter"
            @mouseleave="onFloatingPromptsMouseLeave" 
            ref="quickPromptsPanelRef" 
          >
            <div class="quick-prompts-content-wrapper">
              <!-- Dynamic Prompts (only if context attached) -->
              <div v-if="isTableContextAttached" class="quick-prompt-category">
                <h5 class="prompt-category-title">💡 智能建议 (基于当前表格)</h5>
                <div class="quick-prompts-container dynamic-prompts-container">
                  <button 
                    v-for="(prompt, index) in dynamicPrompts" 
                    :key="`dynamic-${index}`" 
                    @click="handleQuickPromptClick(prompt)" 
                    class="quick-prompt-btn dynamic-btn"
                    :disabled="isLoading" 
                    :title="prompt">
                    {{ prompt }}
                  </button>
                  <span v-if="isLoadingDynamicPrompts && dynamicPrompts.length === 0" class="loading-dynamic-prompts">正在生成建议...</span>
                  <span v-if="!isLoadingDynamicPrompts && dynamicPrompts.length === 0 && isTableContextAttached" class="no-dynamic-prompts">暂无智能建议，可尝试通用指令。</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="input-container"> <!-- Textarea only -->
            <textarea
                  ref="messageInputRef"
                  v-model="inputMessage"
                  @keydown="handleKeyDown"
                  @focus="onMessageInputFocus"
                  placeholder="输入您的问题，按Ctrl+Enter发送..."
                  class="message-input"
                  rows="2"
                  :disabled="isLoading"
                ></textarea>
          </div>

          <div class="actions-toolbar"> <!-- New toolbar for buttons -->
            <div class="actions-toolbar-left">
              <button
                class="quick-prompts-trigger-btn"
                @mouseenter="onFloatingPromptsMouseEnter"
                @click="toggleQuickPromptsPanelVisibility"
                :class="{'panel-expanded': isQuickPromptsPanelExpanded}"
              >
                快捷指令
              </button>
              <button @click="toggleTableContext" class="attach-btn" :title="isTableContextAttached ? '清除引用的表格数据' : '引用当前表格数据'">
                {{ isTableContextAttached ? '清除引用' : '引用表格' }}
              </button>
              <button @click="startDataAnalysis" class="analysis-btn" title="运行数据分析代理">
                分析代理
              </button>
            </div>
            <div class="actions-toolbar-right">
              <button v-if="isLoading" @click="stopProcessing" class="stop-btn" title="停止当前处理">
                ⏹️ 停止
              </button>
              <button @click="sendMessage" :disabled="!inputMessage.trim() || isLoading" class="send-btn">
                {{ isLoading ? '处理中...' : '发送' }}
              </button>
            </div>
          </div>

          <div class="input-hint">
            <span v-if="isTableContextAttached" style="color: #27ae60; font-weight: bold;">ℹ️ 当前已引用表格数据。</span>
            <span v-else>💡 提示：您可以与AI助手进行任何对话，或点击上方按钮引用表格数据。</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, nextTick, watch, computed } from 'vue'
import Plotly from 'plotly.js-dist-min';
import aiService from './js/aiService.js'
import utilFunctions from './js/util.js'
import { renderMarkdown } from './js/markdownRenderer.js'
import LLMConfigPanel from './LLMConfigPanel.vue'
import appConfigManager from './js/appConfigManager.js'
import { JsDataAnalysisAgent } from '../js-data-analysis-agent/core/JsDataAnalysisAgent.js'

export default {
  name: 'AIChatPanel',
  components: {
    LLMConfigPanel
  },
  setup() {
    const hasApiKey = ref(false)
    const isExpanded = ref(true) 
    const isLoading = ref(false)
    const inputMessage = ref('')
    const messages = ref([])
    const messagesContainer = ref(null)
    const showConfigPanel = ref(false)
    const isTableContextAttached = ref(false) 

    const isLoadingDynamicPrompts = ref(false);
    const dynamicPrompts = ref([]);

    const isQuickPromptsPanelExpanded = ref(false);
    const autoCollapseTimer = ref(null);
    const isMouseOverQuickPromptsArea = ref(false); 
    const messageInputRef = ref(null);
    const quickPromptsPanelRef = ref(null);
    const plotContainer = ref(null);

    const onMessageInputFocus = () => {
      expandQuickPromptsPanel(true); 
    };

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

    const expandQuickPromptsPanel = (isAutoTrigger = false) => {
      isQuickPromptsPanelExpanded.value = true;
      clearTimeout(autoCollapseTimer.value);
      if (isAutoTrigger) {
        autoCollapseTimer.value = setTimeout(() => {
          let isHoveringTarget = false;
          if (quickPromptsPanelRef.value && quickPromptsPanelRef.value.matches(':hover')) {
            isHoveringTarget = true;
          }
          const triggerButton = document.querySelector('.quick-prompts-trigger-btn');
          if (triggerButton && triggerButton.matches(':hover')) {
            isHoveringTarget = true;
          }

          if (!isHoveringTarget && !isMouseOverQuickPromptsArea.value) { 
            collapseQuickPromptsPanel();
          }
        }, 4000); 
      }
    };

    const collapseQuickPromptsPanel = () => {
      clearTimeout(autoCollapseTimer.value);
      isQuickPromptsPanelExpanded.value = false;
    };

    const onFloatingPromptsMouseEnter = () => {
      isMouseOverQuickPromptsArea.value = true; 
      expandQuickPromptsPanel(false); 
    };

    const onFloatingPromptsMouseLeave = () => {
      isMouseOverQuickPromptsArea.value = false;
      autoCollapseTimer.value = setTimeout(() => {
         if (!isMouseOverQuickPromptsArea.value) { 
            collapseQuickPromptsPanel();
        }
      }, 300);
    };
    
    const toggleQuickPromptsPanelVisibility = () => {
        if(isQuickPromptsPanelExpanded.value) {
            collapseQuickPromptsPanel();
        } else {
            expandQuickPromptsPanel(true); 
        }
    };

    const handleQuickPromptClick = (promptText) => {
      if (isLoading.value || isLoadingDynamicPrompts.value) return; 
      
      if (!isTableContextAttached.value) {
        addSystemMessage('💡 此快捷指令需要引用表格数据。请先点击“引用表格”。');
      }
      
      inputMessage.value = promptText;
      sendMessage();
      setTimeout(() => collapseQuickPromptsPanel(), 100); 
    };

    const startDataAnalysis = async () => {
      if (!inputMessage.value.trim()) {
        addSystemMessage('⚠️ 请在输入框中输入您的分析请求。');
        return;
      }
      if (!isTableContextAttached.value) {
        addSystemMessage('⚠️ 请先使用“引用表格”按钮引用表格数据。');
        return;
      }

      const userQuery = inputMessage.value.trim();
      console.log("UI: User triggered data analysis with query:", userQuery);
      addUserMessage(userQuery);
      inputMessage.value = '';
      isLoading.value = true;

      addSystemMessage('🚀 正在启动数据分析代理...');
      
      try {
        const tableData = utilFunctions.getTableContextDataAsJson();
        if (!tableData || tableData.length === 0) {
          addSystemMessage('❌ 无法从表格中检索到有效数据。');
          isLoading.value = false;
          return;
        }
        console.log("UI: Extracted table data for agent:", tableData);

        const agent = new JsDataAnalysisAgent();
        const onProgress = (progress) => {
          console.log("UI: Agent progress update:", progress);
          let content = `[${progress.type}] ${progress.content}`;
          addSystemMessage(content);
        };

        const result = await agent.analyze(userQuery, tableData, onProgress);
        console.log("UI: Agent analysis finished. Final result:", result);
        
        if (result.plotSpec) {
            const message = {
                type: 'ai',
                content: '这是您请求的图表：',
                time: new Date().toLocaleTimeString(),
                plotSpec: result.plotSpec
            };
            messages.value.push(message);
            
            await nextTick(); 

            const plotElement = plotContainer.value;
            if (plotElement) {
                Plotly.newPlot(plotElement, result.plotSpec.data, result.plotSpec.layout);
            } else {
                console.error("Plot container not found.");
            }
        } else {
             messages.value.push({
                type: 'ai',
                content: `✅ ${result.report}`,
                time: new Date().toLocaleTimeString()
            });
        }
        scrollToBottom();

      } catch (error) {
        console.error("数据分析代理失败:", error);
        addSystemMessage(`❌ 数据分析失败: ${error.message}`);
      } finally {
        isLoading.value = false;
      }
    };

    const hasStreamingMessage = computed(() => {
      return messages.value.some(message => message.isStreaming)
    })

    const toggleTableContext = async () => {
      if (isTableContextAttached.value) {
        isTableContextAttached.value = false;
        dynamicPrompts.value = []; 
        addSystemMessage('ℹ️ 已取消表格数据引用。下次发送将不包含表格数据。');
        collapseQuickPromptsPanel(); 
      } else {
        isTableContextAttached.value = true;
        addSystemMessage('✅ 表格数据引用已激活。正在尝试获取表格信息以生成智能建议...');
        await fetchAndSetDynamicQuickPrompts();
        expandQuickPromptsPanel(true); 
      }
    }

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
      try {
        if (window.parent && window.parent.Application) {
        }
      } catch (error) {
      }
    }

    const showApiKeyDialog = () => {
      const currentLlm = appConfigManager.getCurrentLlmConfig();
      if (!currentLlm) {
        addSystemMessage('⚠️ 当前没有活动的LLM配置。请先通过设置面板选择或创建一个配置。');
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

    const clearChat = () => {
      if (confirm('确定要清空所有对话记录吗？')) {
        messages.value = [];
        expandQuickPromptsPanel(true); 
      }
    }

    const addSystemMessage = (content) => {
      messages.value.push({
        type: 'system',
        content: content,
        time: new Date().toLocaleTimeString()
      })
      scrollToBottom()
    }

    const updateMessageContent = (messageIndex, newContent) => {
      if (!messages.value[messageIndex]) return;
      const message = messages.value[messageIndex];
      message.content = newContent;
      message.fullContent = newContent; 
    };

    const addUserMessage = (content) => {
      messages.value.push({
        type: 'user',
        content: content,
        time: new Date().toLocaleTimeString()
      })
      scrollToBottom()
    }

    const addAIMessage = (content) => {
      messages.value.push({
        type: 'ai',
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

    const sendMessage = async () => {
      if (!inputMessage.value.trim() || isLoading.value || isLoadingDynamicPrompts.value) return

      let userMessageContent = inputMessage.value.trim()
      addUserMessage(userMessageContent) 
      inputMessage.value = ''
      isLoading.value = true

      let messageToSendToAI = userMessageContent;
      let actualTableDataUsed = false; 

      if (isTableContextAttached.value) {
        try {
          if (typeof wps === 'undefined' || !wps.EtApplication) {
            addSystemMessage('⚠️ WPS JSAPI 环境不可用，无法获取表格数据。本次将不引用表格数据。');
          } else {
            const currentTableMarkdown = utilFunctions.getTableContextDataAsMarkdown();
            if (currentTableMarkdown && currentTableMarkdown.trim() !== '') {
              messageToSendToAI = `请参考以下表格数据：\n${currentTableMarkdown}\n\n针对以上数据，我的问题是：\n${userMessageContent}`;
              actualTableDataUsed = true;
            } else {
              addSystemMessage('⚠️ 未能获取到有效的表格数据（或所选区域为空）。本次将不引用表格数据。');
            }
          }
        } catch (error) {
          console.error("发送时获取表格数据出错:", error);
          addSystemMessage(`❌ 获取表格数据失败: ${error.message}。本次将不引用表格数据。`);
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
      scrollToBottom()

      try {
        await new Promise((resolve, reject) => {
          aiService.callQwenAPIStream(
            messageToSendToAI, 
            finalSystemPrompt, 
            (chunk, content) => {
              if (messages.value[aiMessageIndex]) {
                updateMessageContent(aiMessageIndex, content)
                scrollToBottom()
              }
            },
            (finalContent) => {
              if (messages.value[aiMessageIndex]) {
                messages.value[aiMessageIndex].content = finalContent;
                messages.value[aiMessageIndex].fullContent = finalContent;
                messages.value[aiMessageIndex].isStreaming = false;
              }
              isLoading.value = false;
              resolve(finalContent);
            },
            (error) => {
              reject(error)
            }
          )
        })
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
    }

    const stopProcessing = () => {
      if (aiService && typeof aiService.stop === 'function') {
        aiService.stop();
      }
      isLoading.value = false
      const streamingMessageIndex = messages.value.findIndex(msg => msg.isStreaming)
      if (streamingMessageIndex !== -1) {
        if (messages.value[streamingMessageIndex]) {
            messages.value[streamingMessageIndex].content += '\n\n⏹️ **操作已停止**';
            messages.value[streamingMessageIndex].isStreaming = false;
        }
      }
      scrollToBottom();
      addSystemMessage('⏹️ 已停止当前AI处理请求。');
    }

    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault()
        sendMessage()
      }
    }

    const formatMessage = (content) => {
      if (!content) return '';
      return renderMarkdown(content);
    }

    onMounted(() => {
      checkApiKeyStatus(); 
      expandQuickPromptsPanel(true); 
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
      messagesContainer,
      hasStreamingMessage,
      showConfigPanel,
      isTableContextAttached,
      toggleTableContext,
      dynamicPrompts,
      isQuickPromptsPanelExpanded, 
      expandQuickPromptsPanel,     
      collapseQuickPromptsPanel,   
      onFloatingPromptsMouseEnter, 
      onFloatingPromptsMouseLeave, 
      toggleQuickPromptsPanelVisibility, 
      messageInputRef, 
      onMessageInputFocus, 
      handleQuickPromptClick,
      startDataAnalysis,
      plotContainer,
      togglePanel,
      showApiKeyDialog,
      clearChat,
      sendMessage,
      stopProcessing,
      handleKeyDown,
      formatMessage,
      onConfigChanged,
      quickPromptsPanelRef
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

.ai-chart-display-item {
}

.quick-prompts-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  padding: 0 5px;
  justify-content: flex-start;
  min-height: 28px; 
}

.quick-prompt-category {
  margin-bottom: 12px;
}

.prompt-category-title {
  font-size: 13px;
  font-weight: 600;
  color: #555;
  margin-bottom: 6px;
  padding-left: 5px;
}

.loading-dynamic-prompts, .no-dynamic-prompts {
  font-size: 12px;
  color: #7f8c8d;
  padding: 6px 10px;
  font-style: italic;
}

.quick-prompt-btn {
  background-color: #e9ecef;
  color: #495057;
  border: 1px solid #ced4da;
  padding: 6px 10px;
  border-radius: 15px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  white-space: nowrap; 
}

.analysis-btn {
}
.viz-btn {
}
.dynamic-btn {
  background-color: #e8f5e9; 
  border-color: #a5d6a7;
}
.dynamic-btn:hover {
  background-color: #c8e6c9;
}

.input-area {
  position: relative; 
  border-top: 1px solid #e1e5e9;
  padding: 15px;
  background: #f8f9fa;
}

/* Removed .quick-prompts-trigger-wrapper and .quick-prompts-trigger-btn (old vertical tab) */

.floating-quick-prompts-panel { 
  position: absolute;
  bottom: 80px; /* Increased from 70px to create more space above the input-container */
  left: 0;
  right: 0; 
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-bottom: none;
  border-radius: 8px 8px 0 0; 
  box-shadow: 0px -4px 12px rgba(0,0,0,0.1);
  z-index: 20; 
  max-height: 0;
  opacity: 0;
  overflow: hidden; 
  transition: max-height 0.35s ease-out, opacity 0.3s ease-out, padding-top 0.35s ease-out, padding-bottom 0.35s ease-out, visibility 0s linear 0.35s;
  visibility: hidden;
  padding-left: 15px; 
  padding-right: 15px;
  padding-top: 0; 
  padding-bottom: 0;
}

.floating-quick-prompts-panel.expanded {
  max-height: 75vh; 
  opacity: 1;
  visibility: visible;
  padding-top: 15px; 
  padding-bottom: 10px;
  overflow-y: hidden; 
}

.quick-prompts-content-wrapper {
}

.input-container { /* Now only for textarea */
  display: flex;
}

.message-input {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
  font-size: 14px;
  resize: none;
  font-family: inherit;
}
.message-input:focus {
  outline: none;
  border-color: #3498db;
}

.actions-toolbar { /* New: For buttons below textarea */
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}
.actions-toolbar-left {
  display: flex;
  gap: 8px;
}
.actions-toolbar-right {
  display: flex;
  gap: 8px;
}

/* Style for the new horizontal quick prompts trigger button */
.quick-prompts-trigger-btn { /* This is now the primary trigger */
  background-color: #007bff; 
  color: white;
  border: none;
  padding: 8px 12px; 
  border-radius: 4px; 
  cursor: pointer;
  font-size: 14px; 
  font-weight: 500;
  transition: background-color 0.2s ease;
}
.quick-prompts-trigger-btn.panel-expanded,
.quick-prompts-trigger-btn:hover {
  background-color: #0056b3; 
}

.attach-btn, .send-btn, .stop-btn { /* General styles for action buttons */
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500; /* Added for consistency */
  transition: background-color 0.2s ease; /* Added for consistency */
}

.attach-btn {
  background: #6c757d;
  color: white;
}
.attach-btn:hover {
  background: #5a6268;
}

.stop-btn {
  background: #dc3545;
  color: white;
  animation: pulse 1.5s infinite;
}
.stop-btn:hover {
  background: #c82333;
}

.send-btn {
  background: #28a745; /* Changed to green for primary action */
  color: white;
}
.send-btn:hover {
  background: #1e7e34;
}
.send-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.input-hint {
  margin-top: 10px; /* Increased margin from toolbar */
  font-size: 12px;
  color: #7f8c8d;
  text-align: center;
}


.quick-prompt-btn:hover {
  background-color: #dee2e6;
  border-color: #adb5bd;
}

.quick-prompt-btn:disabled {
  background-color: #f8f9fa;
  color: #adb5bd;
  cursor: not-allowed;
  border-color: #e9ecef;
}



.chat-header {
  background: #f8f9fa;
  border-bottom: 1px solid #e1e5e9;
  padding: 15px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-section h3 {
  margin: 0;
  font-size: 16px;
  color: #2c3e50;
}

.status {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status.online {
  background: #d4edda;
  color: #155724;
}

.status.offline {
  background: #f8d7da;
  color: #721c24;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.config-btn, .toggle-btn, .clear-btn {
  background: none;
  border: 1px solid #ddd;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.config-btn {
  background: #8e44ad;
  color: white;
  border-color: #8e44ad;
}

.config-btn:hover {
  background: #7d3c98;
  border-color: #7d3c98;
}

.toggle-btn:hover, .clear-btn:hover {
  background: #f0f0f0;
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

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
}

.welcome-message {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 15px;
}

.welcome-content h4 {
  margin: 0 0 10px 0;
  color: #2c3e50;
}

.welcome-content ul {
  margin: 10px 0;
  padding-left: 20px;
}

.welcome-content li {
  margin: 5px 0;
  font-size: 14px;
}



.usage-tips {
  margin-top: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #3498db;
}

.usage-tips p {
  margin: 0 0 8px 0;
  font-size: 13px;
}

.usage-tips ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
}

.usage-tips li {
  font-size: 12px;
  color: #666;
  margin: 4px 0;
  font-style: italic;
}

.message {
  margin-bottom: 15px;
}

.message.user .message-content {
  background: #e3f2fd;
  margin-left: 20px;
}

.message.ai .message-content {
  background: #f5f5f5;
  margin-right: 20px;
}

.message.system .message-content {
  background: #fff3cd;
  text-align: center;
  font-style: italic;
}

.message-content {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e1e5e9;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
}

.sender {
  font-weight: 500;
  color: #2c3e50;
}

.time {
  color: #7f8c8d;
}

.streaming-indicator {
  color: #3498db;
  font-size: 11px;
  font-style: italic;
  margin-left: 8px;
}

.message-text {
  line-height: 1.6;
  font-size: 14px;
  position: relative;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* Markdown样式 */
.message-text :deep(.heading-1) {
  font-size: 1.5em;
  font-weight: bold;
  margin: 16px 0 12px 0;
  color: #2c3e50;
  border-bottom: 2px solid #3498db;
  padding-bottom: 8px;
}

.message-text :deep(.heading-2) {
  font-size: 1.3em;
  font-weight: bold;
  margin: 14px 0 10px 0;
  color: #2c3e50;
  border-bottom: 1px solid #bdc3c7;
  padding-bottom: 6px;
}

.message-text :deep(.heading-3) {
  font-size: 1.2em;
  font-weight: bold;
  margin: 12px 0 8px 0;
  color: #34495e;
}

.message-text :deep(.heading-4),
.message-text :deep(.heading-5),
.message-text :deep(.heading-6) {
  font-size: 1.1em;
  font-weight: bold;
  margin: 10px 0 6px 0;
  color: #34495e;
}

.message-text :deep(.paragraph) {
  margin: 8px 0;
  line-height: 1.6;
}

.message-text :deep(.strong-text) {
  font-weight: bold;
  color: #2c3e50;
}

.message-text :deep(.italic-text) {
  font-style: italic;
  color: #7f8c8d;
}

.message-text :deep(.strikethrough-text) {
  text-decoration: line-through;
  color: #95a5a6;
}

.message-text :deep(.inline-code) {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 3px;
  padding: 2px 6px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
  color: #e74c3c;
}

.message-text :deep(.code-block) {
  margin: 12px 0;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e1e5e9;
}

.message-text :deep(.code-header) {
  background: #f8f9fa;
  padding: 8px 12px;
  border-bottom: 1px solid #e1e5e9;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.message-text :deep(.code-language) {
  font-size: 12px;
  color: #6c757d;
  font-weight: 500;
}

.message-text :deep(.copy-code-btn) {
  background: #3498db;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.2s;
}

.message-text :deep(.copy-code-btn:hover) {
  background: #2980b9;
}

.message-text :deep(.code-content) {
  background: #2c3e50;
  color: #ecf0f1;
  padding: 12px;
  margin: 0;
  overflow-x: auto;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
}

.message-text :deep(.code-content code) {
  background: none;
  border: none;
  padding: 0;
  color: inherit;
  font-size: inherit;
}

.message-text :deep(.blockquote) {
  border-left: 4px solid #3498db;
  margin: 12px 0;
  padding: 8px 16px;
  background: #f8f9fa;
  color: #5a6c7d;
  font-style: italic;
}

.message-text :deep(.unordered-list),
.message-text :deep(.ordered-list) {
  margin: 8px 0;
  padding-left: 20px;
}

.message-text :deep(.list-item) {
  margin: 4px 0;
  line-height: 1.5;
}

.message-text :deep(.task-list-item) {
  list-style: none;
  margin: 4px 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.message-text :deep(.task-list-item input) {
  margin-top: 2px;
}

.message-text :deep(.task-content) {
  flex: 1;
}

.message-text :deep(.table-container) {
  margin: 12px 0;
  overflow-x: auto;
}

.message-text :deep(.markdown-table) {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #e1e5e9;
  border-radius: 6px;
  overflow: hidden;
}

.message-text :deep(.table-header) {
  background: #f8f9fa;
  font-weight: bold;
  color: #2c3e50;
  padding: 10px 12px;
  border-bottom: 2px solid #e1e5e9;
  text-align: left;
}

.message-text :deep(.table-cell) {
  padding: 8px 12px;
  border-bottom: 1px solid #f1f3f4;
  vertical-align: top;
}

.message-text :deep(.table-row:nth-child(even) .table-cell) {
  background: #f8f9fa;
}

.message-text :deep(.markdown-link) {
  color: #3498db;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}

.message-text :deep(.markdown-link:hover) {
  border-bottom-color: #3498db;
}

.message-text :deep(.image-container) {
  margin: 12px 0;
  text-align: center;
}

.message-text :deep(.markdown-image) {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.message-text :deep(.image-caption) {
  margin-top: 8px;
  font-size: 12px;
  color: #7f8c8d;
  font-style: italic;
}

.message-text :deep(.horizontal-rule) {
  border: none;
  border-top: 2px solid #e1e5e9;
  margin: 16px 0;
}

.message-text :deep(.emoji-prefix) {
  font-size: 1.1em;
  margin-right: 6px;
}

.streaming-cursor {
  display: inline-block;
  color: #3498db;
  font-weight: bold;
  animation: blink 1s infinite;
  margin-left: 2px;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.loading-dots {
  display: flex;
  gap: 4px;
}

.loading-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3498db;
  animation: loading 1.4s infinite ease-in-out;
}

.loading-dots span:nth-child(1) { animation-delay: -0.32s; }
.loading-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes loading {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.input-area {
  position: relative; 
  border-top: 1px solid #e1e5e9;
  padding: 15px;
  background: #f8f9fa;
}

.input-container { /* Now only for textarea */
  display: flex;
}

.message-input {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
  font-size: 14px;
  resize: none;
  font-family: inherit;
}
.message-input:focus {
  outline: none;
  border-color: #3498db;
}

.actions-toolbar { /* New: For buttons below textarea */
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}
.actions-toolbar-left {
  display: flex;
  gap: 8px;
}
.actions-toolbar-right {
  display: flex;
  gap: 8px;
}

/* Style for the new horizontal quick prompts trigger button */
.quick-prompts-trigger-btn { 
  background-color: #1eaa93; 
  color: white;
  border: none;
  padding: 8px 12px; 
  border-radius: 4px; 
  cursor: pointer;
  font-size: 14px; 
  font-weight: 500;
  transition: background-color 0.2s ease;
}
.quick-prompts-trigger-btn.panel-expanded,
.quick-prompts-trigger-btn:hover {
  background-color: #0d6b34; 
}

.floating-quick-prompts-panel { 
  position: absolute;
  /* Target: Bottom edge of panel should be above the top edge of textarea, with a gap.
     Textarea is in .input-container.
     Below textarea is .actions-toolbar (margin-top: 10px, height ~34px).
     Below actions-toolbar is .input-hint (margin-top: 10px, height ~12px).
     Total height of elements below textarea: (10+34) + (10+12) = 44 + 22 = 66px.
     Let's add a 10px gap above textarea.
     So, panel's bottom should be 66px (for elements below textarea) + 10px (gap) = 76px from the top of textarea.
     This means its 'bottom' from '.input-area' bottom should be:
     height_of_actions_toolbar_block (44px) + height_of_input_hint_block (22px) + desired_gap_above_textarea (10px)
     = 76px.
     The previous value 70px was close. Let's try 76px.
     The panel itself expands upwards from this 'bottom' line.
  */
  bottom: 150px; 
  left: 0;
  right: 0; 
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-bottom: none;
  border-radius: 8px 8px 0 0; 
  box-shadow: 0px -4px 12px rgba(0,0,0,0.1);
  z-index: 20; 
  max-height: 0;
  opacity: 0;
  overflow: hidden; 
  transition: max-height 0.35s ease-out, opacity 0.3s ease-out, padding-top 0.35s ease-out, padding-bottom 0.35s ease-out, visibility 0s linear 0.35s;
  visibility: hidden;
  padding-left: 15px; 
  padding-right: 15px;
  padding-top: 0; 
  padding-bottom: 0;
}

.floating-quick-prompts-panel.expanded {
  max-height: 75vh; 
  opacity: 1;
  visibility: visible;
  padding-top: 15px; 
  padding-bottom: 10px;
  overflow-y: hidden; 
}

.quick-prompts-content-wrapper {
}

.attach-btn, .send-btn, .stop-btn { 
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500; 
  transition: background-color 0.2s ease; 
}

.attach-btn {
  background: #6c757d;
  color: white;
}
.attach-btn:hover {
  background: #5a6268;
}

.stop-btn {
  background: #dc3545;
  color: white;
  animation: pulse 1.5s infinite;
}
.stop-btn:hover {
  background: #c82333;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(220, 53, 69, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(220, 53, 69, 0);
  }
}

.send-btn {
  background: #28a745; 
  color: white;
}
.send-btn:hover {
  background: #1e7e34;
}
.send-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.input-hint {
  margin-top: 10px; 
  font-size: 12px;
  color: #7f8c8d;
  text-align: center;
}
</style>
