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

        <!-- 实时思考过程 -->
        <div v-if="message.type === 'ai' && message.isStreaming && message.currentThought" class="thought-process">
          <span class="thought-icon">🤔</span>
          <div class="thought-text" v-html="formatMessage(message.currentThought)"></div>
        </div>

        <div class="message-text" v-html="formatMessage(message.content)"></div>

        <!-- AI分析步骤流式展示 -->
        <div v-if="message.type === 'ai' && message.steps && message.steps.length > 0" class="analysis-steps">
          <div v-for="(step, stepIndex) in message.steps" :key="`step-${index}-${stepIndex}`" class="analysis-step">
            <details open>
              <summary>第 {{ step.round || stepIndex + 1 }} 步: {{ step.thought || '正在思考...' }}</summary>
              <div class="step-content">
                <div v-if="step.code" class="step-section">
                  <strong>代码:</strong>
                  <pre><code class="language-javascript">{{ step.code }}</code></pre>
                </div>
                <div v-if="step.execution_result && step.execution_result.output" class="step-section result">
                  <strong>结果:</strong>
                  <pre><code>{{ step.execution_result.output }}</code></pre>
                </div>
                <div v-if="step.execution_result && step.execution_result.error" class="step-section error">
                  <strong>错误:</strong>
                  <pre><code>{{ step.execution_result.error }}</code></pre>
                </div>
                <div v-if="step.execution_result && step.execution_result.image_url" class="report-image">
                  <img :src="`http://127.0.0.1:8000/outputs/${step.execution_result.image_url}`" alt="分析图表" />
                </div>
              </div>
            </details>
          </div>
        </div>

        <!-- Plotly 高级图表显示 (用于最终结果) -->
        <div v-if="message.type === 'ai' && message.plotlyConfig" class="charts-wrapper">
          <AdvancedChartDisplay
            :key="`plotly-${index}`"
            :plotly-config="message.plotlyConfig"
            :title="message.plotlyConfig.layout?.title?.text || '高级数据分析图表'"
            :description="'基于 Plotly.js 的高级数据可视化'"
            class="ai-chart-display-item"
          />
        </div>

        <!-- 后端生成的图片展示 -->
        <div v-if="message.type === 'ai' && message.images && message.images.length > 0" class="report-images">
          <div v-for="(image, imgIndex) in message.images" :key="`img-${index}-${imgIndex}`" class="report-image">
            <img :src="`http://127.0.0.1:8000/outputs/${image}`" alt="分析图表" />
          </div>
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
import AdvancedChartDisplay from '../AdvancedChartDisplay.vue';

export default {
  name: 'ChatMessageList',
  components: {
    AdvancedChartDisplay
  },
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
}
.time {
  color: #7f8c8d;
}
.message-text {
  line-height: 1.6;
  font-size: 14px;
  word-wrap: break-word;
}
.thought-process {
  background-color: #e9f5fe;
  border: 1px solid #d1e9fc;
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 10px;
  display: flex;
  align-items: flex-start;
  font-size: 14px;
}
.thought-icon {
  margin-right: 10px;
  font-size: 18px;
}
.thought-text {
  flex: 1;
  line-height: 1.5;
}
.analysis-steps {
  margin-top: 12px;
  border-top: 1px solid #e1e5e9;
  padding-top: 12px;
}
.analysis-step {
  margin-bottom: 10px;
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
}
.analysis-step details {
  padding: 10px;
}
.analysis-step summary {
  font-weight: 500;
  cursor: pointer;
}
.step-content {
  margin-top: 10px;
  padding-left: 15px;
  border-left: 2px solid #3498db;
}
.step-section {
  margin-bottom: 8px;
}
.step-section strong {
  font-size: 13px;
  color: #555;
}
.step-section pre {
  margin: 4px 0 0 0;
  padding: 10px;
  background: #fdfdfd;
  border: 1px solid #eee;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
}
.step-section.error pre {
  background: #fff5f5;
  color: #c0392b;
}
.charts-wrapper {
  margin-top: 12px;
}
.report-images {
  margin-top: 15px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.report-image img {
  max-width: 100%;
  border-radius: 6px;
  border: 1px solid #ddd;
}
</style>
