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
      <div class="message-content">
        <div class="message-header">
          <span class="sender">{{ message.type === 'user' ? '👤 您' : '🤖 AI助手' }}</span>
          <span class="time">{{ message.time }}</span>
          <span v-if="message.isStreaming" class="streaming-indicator">正在输入...</span>
        </div>
        <div class="message-text" v-html="formatMessage(message.content)"></div>
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
import { renderMarkdown } from '../js/markdownRenderer.js';
import ChartDisplay from '../ChartDisplay.vue';

export default {
  name: 'ChatMessageList',
  components: { ChartDisplay },
  props: {
    messages: {
      type: Array,
      required: true,
    },
    isLoading: {
      type: Boolean,
      required: true,
    },
    hasStreamingMessage: {
      type: Boolean,
      required: true,
    },
  },
  setup(props) {
    const messagesContainer = ref(null);

    const scrollToBottom = () => {
      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
        }
      });
    };

    watch(() => props.messages, scrollToBottom, { deep: true });

    const formatMessage = (content) => {
      if (!content) return '';
      return renderMarkdown(content);
    };

    return {
      messagesContainer,
      formatMessage,
    };
  },
};
</script>

<style scoped>
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

.charts-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ai-chart-display-item {
}

/* Markdown-specific styles are not included here as they are global or handled by the renderer */
</style>
