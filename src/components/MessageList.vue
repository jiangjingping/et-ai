<template>
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

    <div v-for="(message, index) in messages" :key="index" class="message" :class="message.type">
      <!-- Standard User/AI Message -->
      <div v-if="message.type === 'user' || message.type === 'ai'" class="message-content">
        <div class="message-header">
          <span class="sender">{{ message.type === 'user' ? '👤 您' : '🤖 AI助手' }}</span>
          <span class="time">{{ message.time }}</span>
          <span v-if="message.isStreaming" class="streaming-indicator">正在输入...</span>
        </div>
        <div class="message-text" v-if="!message.plotSpec" v-html="message.content"></div>
        <PlotlyChart v-if="message.plotSpec" :spec="message.plotSpec" />
        <div v-if="message.isStreaming && message.content" class="streaming-cursor">▋</div>
      </div>
      
      <!-- Agent Round Message (Collapsible) -->
      <div v-if="message.type === 'agent_round'" class="agent-step-message">
        <div class="message-header collapsible-header" @click="toggleCollapse(message)">
          <span class="toggle-icon">{{ message.isCollapsed ? '▶' : '▼' }}</span>
          <span class="sender">{{ message.title }}</span>
          <span class="time">{{ message.time }}</span>
        </div>
        <div v-show="!message.isCollapsed" class="message-content">
          <div v-for="(step, stepIndex) in message.steps" :key="stepIndex" class="agent-sub-step">
            <div v-if="step.type === 'thought'">
              <strong>🤔 思考:</strong>
              <div v-html="step.content"></div>
            </div>
            <div v-if="step.type === 'code'">
              <strong>💻 代码:</strong>
              <div>
                <div v-html="formatMessage('```\n' + step.content + '\n```')"></div>
                <strong>📊 结果:</strong>
                <div class="code-result">
                  <span>{{ step.result.summary }}</span>
                  <button v-if="step.result.details" @click="step.result.showDetails = !step.result.showDetails" class="details-btn">
                    {{ step.result.showDetails ? '隐藏详情' : '查看详情' }}
                  </button>
                </div>
                <div v-if="step.result.showDetails" class="result-details">
                  <pre>{{ step.result.isError ? step.result.details : JSON.stringify(JSON.parse(step.result.details), null, 2) }}</pre>
                </div>
              </div>
            </div>
             <div v-if="step.type === 'error'">
              <strong>❌ 错误:</strong>
              <p>{{ step.content }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Simple System Message -->
      <div v-if="message.type === 'system'" class="message-content system-info">
         <p><strong>{{ message.title || '系统提示' }}:</strong> {{ message.content }}</p>
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
</template>

<script>
import { ref, watch, nextTick } from 'vue';
import { renderMarkdown } from './js/markdownRenderer.js';
import PlotlyChart from './PlotlyChart.vue';

export default {
  name: 'MessageList',
  components: {
    PlotlyChart,
  },
  props: {
    messages: Array,
    isLoading: Boolean,
    hasStreamingMessage: Boolean,
  },
  setup(props) {
    const messagesContainer = ref(null);

    const formatMessage = (content) => {
      if (!content) return '';
      return renderMarkdown(content);
    };

    const scrollToBottom = () => {
      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
        }
      });
    };

    const toggleCollapse = (message) => {
      message.isCollapsed = !message.isCollapsed;
    };

    watch(() => props.messages.length, () => {
      scrollToBottom();
    });

    return {
      messagesContainer,
      formatMessage,
      toggleCollapse,
    };
  }
}
</script>

<style scoped>
.code-result {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
}
.details-btn {
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #f0f0f0;
}
.details-btn:hover {
  background-color: #e0e0e0;
}
.result-details {
  margin-top: 8px;
  padding: 10px;
  background-color: #f8f8f8;
  border: 1px solid #eee;
  border-radius: 4px;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: 12px;
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

.system-info {
  background: #e9f7fe;
  color: #0c5460;
  border-left: 4px solid #3da9fc;
  text-align: left;
  font-style: normal;
}

.agent-step-message {
  margin-bottom: 15px;
}

.collapsible-header {
  cursor: pointer;
  background: #f0f2f5;
  padding: 8px 12px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.2s ease;
}

.collapsible-header:hover {
  background-color: #e4e6eb;
}

.toggle-icon {
  font-family: monospace;
  font-weight: bold;
}

.agent-step-message .message-content {
  margin-top: -8px;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-top: 1px solid #dcdfe6;
  padding: 12px;
  background: #fafafa;
}

.agent-sub-step {
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px dashed #e0e0e0;
}
.agent-sub-step:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
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
</style>
