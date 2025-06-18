<template>
  <div class="chat-header">
    <div class="header-content">
      <div class="title-section">
        <h3>🤖 AI智能助手</h3>
        <span class="status" :class="{ 'online': hasApiKey, 'offline': !hasApiKey }">
          {{ hasApiKey ? '在线' : '离线' }}
        </span>
      </div>
      <div class="header-actions">
        <button @click="$emit('toggle-config')" class="config-btn" title="LLM配置">
          ⚙️
        </button>
        <button @click="$emit('toggle-panel')" class="toggle-btn" :title="isExpanded ? '收起面板' : '展开面板'">
          {{ isExpanded ? '◀' : '▶' }}
        </button>
        <button @click="$emit('clear-chat')" class="clear-btn" title="清空对话">🗑️</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ChatHeader',
  props: {
    hasApiKey: {
      type: Boolean,
      required: true
    },
    isExpanded: {
      type: Boolean,
      required: true
    }
  },
  emits: ['toggle-config', 'toggle-panel', 'clear-chat']
}
</script>

<style scoped>
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
</style>
