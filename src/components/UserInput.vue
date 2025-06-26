<template>
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
    
    <div class="input-container">
      <textarea
            ref="messageInputRef"
            :value="modelValue"
            @input="$emit('update:modelValue', $event.target.value)"
            @keydown="handleKeyDown"
            @focus="onMessageInputFocus"
            placeholder="输入您的问题，按Ctrl+Enter发送..."
            class="message-input"
            rows="2"
            :disabled="isLoading"
          ></textarea>
    </div>

    <div class="actions-toolbar">
      <div class="actions-toolbar-left">
        <button
          class="quick-prompts-trigger-btn"
          @mouseenter="onFloatingPromptsMouseEnter"
          @click="toggleQuickPromptsPanelVisibility"
          :class="{'panel-expanded': isQuickPromptsPanelExpanded}"
        >
          快捷指令
        </button>
        <button @click="$emit('toggleTableContext')" class="attach-btn" :title="isTableContextAttached ? '清除引用的表格数据' : '引用当前表格数据'">
          {{ isTableContextAttached ? '清除引用' : '引用表格' }}
        </button>
        <button 
          @click="$emit('toggleAgentMode')" 
          class="analysis-btn" 
          :class="{ active: isAgentMode }"
          title="切换数据分析代理模式"
        >
          分析代理
        </button>
      </div>
      <div class="actions-toolbar-right">
        <button v-if="isLoading" @click="$emit('stop')" class="stop-btn" title="停止当前处理">
          ⏹️ 停止
        </button>
        <button @click="$emit('submit')" :disabled="!modelValue.trim() || isLoading" class="send-btn">
          {{ isLoading ? '处理中...' : '发送' }}
        </button>
      </div>
    </div>

    <div class="input-hint">
      <span v-if="isTableContextAttached" style="color: #27ae60; font-weight: bold;">ℹ️ 当前已引用表格数据。</span>
      <span v-else>💡 提示：您可以与AI助手进行任何对话，或点击上方按钮引用表格数据。</span>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue';

export default {
  name: 'UserInput',
  props: {
    modelValue: String,
    isLoading: Boolean,
    isTableContextAttached: Boolean,
    isLoadingDynamicPrompts: Boolean,
    dynamicPrompts: Array,
    isAgentMode: Boolean,
  },
  emits: [
    'update:modelValue',
    'submit',
    'toggleTableContext',
    'toggleAgentMode',
    'stop',
    'quickPrompt',
  ],
  setup(props, { emit }) {
    const isQuickPromptsPanelExpanded = ref(false);
    const autoCollapseTimer = ref(null);
    const isMouseOverQuickPromptsArea = ref(false); 
    const messageInputRef = ref(null);
    const quickPromptsPanelRef = ref(null);

    const onMessageInputFocus = () => {
      expandQuickPromptsPanel(true); 
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
      emit('quickPrompt', promptText);
      setTimeout(() => collapseQuickPromptsPanel(), 100); 
    };

    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        emit('sendMessage');
      }
    };

    return {
      isQuickPromptsPanelExpanded,
      autoCollapseTimer,
      isMouseOverQuickPromptsArea,
      messageInputRef,
      quickPromptsPanelRef,
      onMessageInputFocus,
      expandQuickPromptsPanel,
      collapseQuickPromptsPanel,
      onFloatingPromptsMouseEnter,
      onFloatingPromptsMouseLeave,
      toggleQuickPromptsPanelVisibility,
      handleQuickPromptClick,
      handleKeyDown,
    };
  }
}
</script>

<style scoped>
.input-area {
  position: relative; 
  border-top: 1px solid #e1e5e9;
  padding: 15px;
  background: #f8f9fa;
}

.floating-quick-prompts-panel { 
  position: absolute;
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

.input-container {
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

.actions-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}
.actions-toolbar-left, .actions-toolbar-right {
  display: flex;
  gap: 8px;
}

.quick-prompts-trigger-btn, .attach-btn, .send-btn, .stop-btn, .analysis-btn {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s ease;
}

.quick-prompts-trigger-btn { 
  background-color: #1eaa93; 
  color: white;
}
.quick-prompts-trigger-btn.panel-expanded,
.quick-prompts-trigger-btn:hover {
  background-color: #0d6b34; 
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

.quick-prompts-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  padding: 0 5px;
  justify-content: flex-start;
  min-height: 28px; 
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

.dynamic-btn {
  background-color: #e8f5e9; 
  border-color: #a5d6a7;
}
.dynamic-btn:hover {
  background-color: #c8e6c9;
}

.analysis-btn {
  background-color: #6c757d;
  color: white;
}
.analysis-btn.active {
  background-color: #28a745;
  box-shadow: 0 0 8px rgba(40, 167, 69, 0.5);
}
.analysis-btn:hover {
  opacity: 0.9;
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
</style>
