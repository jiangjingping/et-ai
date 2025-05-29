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
                <p>输入框上方提供了一些常用指令按钮，点击即可快速发送！</p>
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
              <div class="message-text" v-html="formatMessage(message.content)"></div>
              <!-- 修改为遍历 chartOptions 渲染多个图表 -->
              <div v-if="message.type === 'ai' && message.chartOptions && message.chartOptions.length > 0" class="charts-wrapper">
                <ChartDisplay 
                  v-for="(chartOpt, chartIndex) in message.chartOptions" 
                  :key="`chart-${index}-${chartIndex}`" 
                  :option="chartOpt" 
                  class="ai-chart-display-item"
                />
              </div>
              <div v-if="message.isStreaming && message.content" class="streaming-cursor">▋</div>
            </div>
          </div>

          <!-- 加载指示器 (仅在初始化时显示) -->
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
          <div class="quick-prompts-container" v-if="quickPrompts.length > 0">
            <button 
              v-for="(prompt, index) in quickPrompts" 
              :key="index" 
              @click="handleQuickPromptClick(prompt)" 
              class="quick-prompt-btn"
              :disabled="isLoading"
              :title="prompt">
              {{ prompt }}
            </button>
          </div>
          <div class="input-container">
            <textarea
              v-model="inputMessage"
              @keydown="handleKeyDown"
              placeholder="输入您的问题，按Ctrl+Enter发送..."
              class="message-input"
              rows="2"
              :disabled="isLoading"
            ></textarea>
            <div class="input-actions">
              <button @click="toggleTableContext" class="attach-btn" :title="isTableContextAttached ? '清除引用的表格数据' : '引用当前表格数据'">
                {{ isTableContextAttached ? '清除引用' : '引用表格' }}
              </button>
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
import aiService from './js/aiService.js'
import utilFunctions from './js/util.js'
import { renderMarkdown } from './js/markdownRenderer.js'
import LLMConfigPanel from './LLMConfigPanel.vue'
import ChartDisplay from './ChartDisplay.vue' // 导入图表组件
import appConfigManager from './js/appConfigManager.js'

export default {
  name: 'AIChatPanel',
  components: {
    LLMConfigPanel,
    ChartDisplay // 注册图表组件
  },
  setup() {
    const hasApiKey = ref(false)
    const isExpanded = ref(true)
    const isLoading = ref(false)
    const inputMessage = ref('')
    const messages = ref([])
    const messagesContainer = ref(null)
    const showConfigPanel = ref(false)
    // const tableContextMarkdown = ref('') // 不再需要缓存Markdown数据于此
    const isTableContextAttached = ref(false) // 标记是否激活了表格数据引用功能

    const quickPrompts = ref([
      "帮我把这些数据可视化",
      "总结一下当前引用的表格",
      "基于数据分析趋势",
      "用折线图展示数据",
      "用饼图显示各部分占比",
      "创建柱状图比较数据",
      "解释这份数据的主要特点"
    ]);

    const handleQuickPromptClick = (promptText) => {
      if (isLoading.value) return; // 如果正在加载，不允许发送快捷指令
      
      // 优化点1：如果表格引用未激活，则激活它
      if (!isTableContextAttached.value) {
        isTableContextAttached.value = true;
        addSystemMessage('✅ 表格数据引用已激活，将基于当前表格数据执行快捷指令。');
      }
      
      inputMessage.value = promptText;
      sendMessage();
    };

    // 计算属性：检查是否有正在流式输出的消息
    const hasStreamingMessage = computed(() => {
      return messages.value.some(message => message.isStreaming)
    })

    // 引用/取消引用表格数据
    const toggleTableContext = () => {
      if (isTableContextAttached.value) {
        isTableContextAttached.value = false;
        addSystemMessage('ℹ️ 已取消表格数据引用。下次发送将不包含表格数据。');
      } else {
        isTableContextAttached.value = true;
        // 提示用户，数据将在发送时获取
        addSystemMessage('✅ 表格数据引用已激活。下次发送时将获取并包含当前表格数据。');
      }
    }

    // 检查API Key状态
    const checkApiKeyStatus = () => {
      const currentLlm = appConfigManager.getCurrentLlmConfig()
      hasApiKey.value = !!(currentLlm && currentLlm.apiKey)
    }

    // 配置变更处理
    const onConfigChanged = (newConfig) => {
      checkApiKeyStatus()
      showConfigPanel.value = false
      if (newConfig && newConfig.apiKey) {
        addSystemMessage(`✅ 已切换到配置：${newConfig.name}，现在可以开始对话了。`)
      }
    }



    // 切换面板展开/收起
    const togglePanel = () => {
      isExpanded.value = !isExpanded.value
      // 如果在任务窗格中，可以调整窗格宽度
      try {
        if (window.parent && window.parent.Application) {
          // 这里可以添加调整任务窗格宽度的逻辑
        }
      } catch (error) {
        // 忽略跨域错误
      }
    }

    // 显示API Key设置对话框
    const showApiKeyDialog = () => {
      const currentLlm = appConfigManager.getCurrentLlmConfig();
      if (!currentLlm) {
        addSystemMessage('⚠️ 当前没有活动的LLM配置。请先通过设置面板选择或创建一个配置。');
        showConfigPanel.value = true; // Open the config panel
        return;
      }

      const promptMessage = `请输入API Key для配置 "${currentLlm.name}":`;
      const newKey = prompt(promptMessage, currentLlm.apiKey || '');

      if (newKey !== null) { // User might press cancel, newKey will be null
        if (newKey.trim()) {
          try {
            appConfigManager.updateLlmConfig(currentLlm.id, { apiKey: newKey.trim() });
            checkApiKeyStatus(); // Re-check status
            addSystemMessage(`✅ API Key已为配置 "${currentLlm.name}" 更新。`);
            if(hasApiKey.value) {
                 addSystemMessage('现在可以开始对话了。');
            }
          } catch (error) {
            console.error("更新API Key失败:", error);
            addSystemMessage(`❌ 更新API Key失败: ${error.message}`);
          }
        } else {
          // User entered an empty string, potentially to clear it
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

    // 清空对话
    const clearChat = () => {
      if (confirm('确定要清空所有对话记录吗？')) {
        messages.value = []
      }
    }

    // 添加系统消息
    const addSystemMessage = (content) => {
      messages.value.push({
        type: 'system',
        content: content,
        time: new Date().toLocaleTimeString()
      })
      scrollToBottom()
    }

    // 智能更新消息内容 - 解决内容覆盖问题
    const updateMessageContent = (messageIndex, newContent) => {
      if (!messages.value[messageIndex]) return;

      const message = messages.value[messageIndex];

      // 始终使用最新的完整内容更新，特别是在流式传输期间
      // 我们假设 newContent 是从 aiService 传递过来的完整累积内容
      message.content = newContent;
      message.fullContent = newContent; // 确保 fullContent 也同步更新

      // 如果需要区分流式结束后的最终处理和流式过程中的更新，
      // 可以在调用此函数的地方，或者在此函数内部根据 message.isStreaming 状态来决定是否做其他操作。
      // 但对于内容更新本身，直接替换是最安全的，以避免重复。
    };

    // 添加用户消息
    const addUserMessage = (content) => {
      messages.value.push({
        type: 'user',
        content: content,
        time: new Date().toLocaleTimeString()
      })
      scrollToBottom()
    }

    // 添加AI消息
    const addAIMessage = (content) => {
      messages.value.push({
        type: 'ai',
        content: content,
        time: new Date().toLocaleTimeString()
      })
      scrollToBottom()
    }

    // 滚动到底部
    const scrollToBottom = () => {
      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
      })
    }





    // 发送消息
    const sendMessage = async () => {
      if (!inputMessage.value.trim() || isLoading.value) return

      let userMessageContent = inputMessage.value.trim()
      addUserMessage(userMessageContent) // 显示原始用户消息
      inputMessage.value = ''
      isLoading.value = true

      // 如果引用了表格数据，则在此时获取并添加到发送给AI的消息内容中
      let messageToSendToAI = userMessageContent;
      let actualTableDataUsed = false; // 标记本次发送是否实际使用了表格数据

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
      
      // 检查用户是否意图生成图表
      const chartKeywords = [
        '图表', '可视化', '柱状图', '折线图', '饼图', '趋势', '分布', '占比', '生成图', '画图',
        '条形图', '散点图', '面积图', '雷达图', '热力图', 'K线图', '箱线图', // 新增图表类型
        '绘制', '展现', '统计图' // 新增相关动词和描述
      ];
      const isChartRequest = chartKeywords.some(keyword => userMessageContent.toLowerCase().includes(keyword.toLowerCase()));
      let finalSystemPrompt = '你是一个友好、专业的AI助手，可以帮助用户解答各种问题，提供建议和帮助。请用中文回答。';

      if (isChartRequest && actualTableDataUsed) { // 只有在引用了表格数据且用户意图生成图表时才修改Prompt
        finalSystemPrompt = `你是一个数据可视化助手。用户提供了Markdown格式的表格数据和图表生成请求。
请执行以下操作：
1. 分析数据和用户要求。
2. 如果用户没有明确指定图表类型，请根据数据特征判断最适合的ECharts图表类型（例如：折线图、柱状图、饼图、散点图等）。
3. 生成一个完整的、可以直接在ECharts中使用的option JSON对象。确保JSON格式正确无误。
4. 在你的文字回复中，可以简要说明你选择的图表类型（如果是由你推荐的）以及图表所展示的主要内容。
请将ECharts option JSON对象包裹在 \`\`\`json 和 \`\`\` 之间。
**重要：生成的JSON对象必须是纯粹的数据结构，绝对不能包含任何JavaScript函数、回调函数或任何形式的可执行代码。如果某个配置项（如tooltip的formatter、label的formatter等）通常使用函数，请尝试使用ECharts支持的字符串模板变量，或者直接省略该formatter配置，以确保输出是严格合法的JSON。**
例如：
这是您要求的图表配置：
\`\`\`json
{
  "title": {"text": "示例图表"},
  "tooltip": {"trigger": "axis"},
  "xAxis": {"type": "category", "data": ["A", "B", "C"]},
  "yAxis": {"type": "value"},
  "series": [{"data": [10, 20, 30], "type": "bar", "name": "系列1"}]
}
\`\`\`
如果无法根据提供的数据或用户请求生成有效的、不含函数的图表配置，请明确说明原因，不要生成不完整的或错误的JSON。`;
      }


      // 创建一个AI消息占位符，用于流式更新
      const aiMessageIndex = messages.value.length
      messages.value.push({
        type: 'ai',
        content: '',
        time: new Date().toLocaleTimeString(),
        isStreaming: true,
        fullContent: '',
        chartOption: null // 为图表配置占位
      })
      scrollToBottom()

      try {
        await new Promise((resolve, reject) => {
          aiService.callQwenAPIStream(
            messageToSendToAI, 
            finalSystemPrompt, // 使用更新后的系统Prompt
            // onChunk: 流式更新
            (chunk, content) => {
              if (messages.value[aiMessageIndex]) {
                updateMessageContent(aiMessageIndex, content)
                scrollToBottom()
              }
            },
            // onComplete: 完成
            (finalContent) => {
              if (messages.value[aiMessageIndex]) {
                messages.value[aiMessageIndex].content = finalContent;
                messages.value[aiMessageIndex].fullContent = finalContent;
                messages.value[aiMessageIndex].isStreaming = false;

                // 尝试从finalContent中提取图表JSON
                if (isChartRequest) { // 只在图表请求时尝试解析
                    const extractedChartOptions = extractJsonFromText(finalContent); // 现在返回数组
                    if (extractedChartOptions && extractedChartOptions.length > 0) {
                        messages.value[aiMessageIndex].chartOptions = extractedChartOptions;
                        console.log('[AIChatPanel] 图表配置已提取并存入消息对象:', JSON.parse(JSON.stringify(messages.value[aiMessageIndex].chartOptions)));
                    } else {
                        console.log('[AIChatPanel] onComplete: 未提取到图表配置或配置为空数组。');
                    }
                }
              }
              isLoading.value = false;
              resolve(finalContent);
            },
            // onError: 错误
            (error) => {
              reject(error)
            }
          )
        })
      } catch (error) {
        // 检查错误是否是由于用户中止请求造成的
        if (error.name === 'AbortError') {
          console.log('AI请求被用户中止。');
          // isLoading.value 已经在 stopProcessing 中设置为 false
          // messages.value[aiMessageIndex] 的状态也已在 stopProcessing 中处理
          // 这里不需要再额外更新消息内容为错误信息
          // 确保 isStreaming 最终为 false
          if (messages.value[aiMessageIndex]) {
            messages.value[aiMessageIndex].isStreaming = false;
          }
        } else {
          // 对于其他类型的错误，正常显示错误信息
          console.error('AI对话失败:', error);
          if (messages.value[aiMessageIndex]) {
            messages.value[aiMessageIndex].content = `❌ 抱歉，处理您的问题时出现错误：${error.message}`;
            messages.value[aiMessageIndex].isStreaming = false;
          }
        }
        isLoading.value = false; // 确保在任何错误情况下都重置isLoading
      }
    }

    // 停止当前处理
    const stopProcessing = () => {
      // 调用aiService中的停止方法
      if (aiService && typeof aiService.stop === 'function') {
        aiService.stop();
      }

      // 停止加载状态
      isLoading.value = false

      // 更新当前流式消息
      const streamingMessageIndex = messages.value.findIndex(msg => msg.isStreaming)
      if (streamingMessageIndex !== -1) {
        // 确保在修改前消息仍然存在
        if (messages.value[streamingMessageIndex]) {
            messages.value[streamingMessageIndex].content += '\n\n⏹️ **操作已停止**';
            messages.value[streamingMessageIndex].isStreaming = false;
        }
      }
      // 确保滚动到底部以显示停止消息
      scrollToBottom();
      addSystemMessage('⏹️ 已停止当前AI处理请求。');
    }

    // 处理键盘事件
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault()
        sendMessage()
      }
    }

    // 格式化消息内容
    const formatMessage = (content) => {
      if (!content) return '';
      // 避免在渲染时重复移除JSON块，如果已在onComplete中处理
      // const textWithoutJson = content.replace(/```json\s*([\s\S]*?)\s*```/, "").trim();
      // return renderMarkdown(textWithoutJson || content); // 如果移除后为空，则渲染原始内容
      return renderMarkdown(content);
    }

    // 从文本中提取JSON的辅助函数
    const extractJsonFromText = (text) => {
        const options = []; // 正确初始化 options 数组
        if (!text) return options; // 如果文本为空，返回空数组

        const regex = /```json\s*([\s\S]*?)\s*```/g; // 使用全局匹配
        let match;
        while ((match = regex.exec(text)) !== null) {
            if (match[1]) { // 确保匹配到捕获组
                try {
                    const parsedOption = JSON.parse(match[1]);
                    console.log('[AIChatPanel] extractJsonFromText: 单个图表JSON解析成功:', JSON.parse(JSON.stringify(parsedOption)));
                    options.push(parsedOption);
                } catch (e) {
                    console.error("[AIChatPanel] extractJsonFromText: 解析图表JSON失败:", e, "\n原始JSON字符串:", match[1]);
                    addSystemMessage("⚠️ AI返回的部分图表配置解析失败。");
                    // 不中断，继续尝试解析其他可能的JSON块
                }
            }
        }
        return options; // 返回所有成功解析的option对象数组
    }

    onMounted(() => {
      checkApiKeyStatus(); // Initial check
      // The welcome message logic or API key prompt in the template handles initial UI state.
      // System messages about readiness are better handled after successful config changes or key setup.
    })

    // Watch for changes in the current LLM config's API key directly from appConfigManager
    // This ensures reactivity if the key is changed elsewhere or by LLMConfigPanel.
    watch(() => appConfigManager.getCurrentLlmConfig()?.apiKey, (newApiKey, oldApiKey) => {
        if (newApiKey !== oldApiKey) {
            checkApiKeyStatus();
        }
    }, { immediate: false }); // immediate: false because onMounted already calls checkApiKeyStatus

    return {
      hasApiKey,
      isExpanded,
      isLoading,
      inputMessage,
      messages,
      messagesContainer,
      hasStreamingMessage,
      showConfigPanel,
      // tableContextMarkdown, // 不再需要导出
      isTableContextAttached, // 导出
      toggleTableContext, // 导出
      quickPrompts, // 导出快捷指令
      handleQuickPromptClick, // 导出点击处理函数
      togglePanel,
      showApiKeyDialog,
      clearChat,
      sendMessage,
      stopProcessing,
      handleKeyDown,
      formatMessage,
      onConfigChanged
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
  margin-top: 10px; /* 图表与上方文本的间距 */
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.charts-wrapper {
  display: flex;
  flex-direction: column; /* 多个图表垂直排列 */
  gap: 10px; /* 图表之间的间距 */
}

.ai-chart-display-item {
  /* 可以为单个图表项设置特定样式，如果需要的话 */
  /* 例如，如果希望它们水平排列且换行，可以在 .charts-wrapper 中用 flex-wrap */
}

.quick-prompts-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  padding: 0 5px; /* 左右留一些边距 */
  justify-content: flex-start; /* 从左开始排列 */
}

.quick-prompt-btn {
  background-color: #e9ecef;
  color: #495057;
  border: 1px solid #ced4da;
  padding: 6px 10px;
  border-radius: 15px; /* 圆角按钮 */
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  white-space: nowrap; /* 防止按钮内文字换行，让宽度自适应 */
  /* overflow: hidden; // 移除，以便内容能撑开按钮 */
  /* text-overflow: ellipsis; // 移除 */
  /* max-width: 150px; // 移除最大宽度限制 */
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
  border-top: 1px solid #e1e5e9;
  padding: 15px;
  background: #f8f9fa;
}

.input-container {
  display: flex;
  gap: 10px;
  align-items: flex-end;
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

.input-actions {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.attach-btn, .send-btn, .stop-btn {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.attach-btn {
  background: #6c757d;
  color: white;
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
  background: #3498db;
  color: white;
}

.send-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.input-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #7f8c8d;
  text-align: center;
}


</style>
