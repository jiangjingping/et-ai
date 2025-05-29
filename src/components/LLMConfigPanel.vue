<template>
  <div class="llm-config-panel">
    <!-- 配置选择器 -->
    <div class="config-selector">
      <div class="selector-header">
        <h3>🤖 LLM配置管理</h3>
        <div class="selector-actions">
          <button @click="showConfigDialog = true" class="btn-primary">
            <i class="icon">➕</i> 新建配置
          </button>
          <button @click="showImportDialog = true" class="btn-secondary">
            <i class="icon">📥</i> 导入
          </button>
          <button @click="exportConfigs" class="btn-secondary">
            <i class="icon">📤</i> 导出
          </button>
        </div>
      </div>

      <div class="current-config">
        <label>当前配置:</label>
        <select v-model="selectedConfigId" @change="switchConfig" class="config-select">
          <option v-for="config in configs" :key="config.id" :value="config.id">
            {{ config.name }} ({{ config.provider }})
          </option>
        </select>
        <button @click="testCurrentConfig" class="btn-test" :disabled="testing">
          <i class="icon">🔧</i> {{ testing ? '测试中...' : '测试连接' }}
        </button>
      </div>

      <!-- 当前配置详情 -->
      <div v-if="currentConfig" class="config-details">
        <div class="config-info">
          <div class="info-item">
            <span class="label">模型:</span>
            <span class="value">{{ currentConfig.model }}</span>
          </div>
          <div class="info-item">
            <span class="label">Base URL:</span>
            <span class="value">{{ currentConfig.baseURL }}</span>
          </div>
          <div class="info-item">
            <span class="label">API Key:</span>
            <span class="value">{{ currentConfig.apiKey ? '已设置' : '未设置' }}</span>
          </div>
          <div class="info-item">
            <span class="label">描述:</span>
            <span class="value">{{ currentConfig.description }}</span>
          </div>
        </div>

        <div class="config-actions">
          <button @click="editConfig(currentConfig)" class="btn-edit">
            <i class="icon">✏️</i> 编辑
          </button>
          <button v-if="!currentConfig.isPreset" @click="deleteConfig(currentConfig.id)" class="btn-delete">
            <i class="icon">🗑️</i> 删除
          </button>
        </div>
      </div>
    </div>

    <!-- 配置列表 -->
    <div class="config-list">
      <h4>所有配置</h4>
      <div class="config-grid">
        <div
          v-for="config in configs"
          :key="config.id"
          class="config-card"
          :class="{ active: config.id === selectedConfigId }"
          @click="selectConfig(config.id)"
        >
          <div class="card-header">
            <h5>{{ config.name }}</h5>
            <span class="provider-badge">{{ config.provider }}</span>
          </div>
          <div class="card-body">
            <p class="model">{{ config.model }}</p>
            <p class="description">{{ config.description }}</p>
            <div class="status">
              <span :class="['status-indicator', config.apiKey ? 'configured' : 'not-configured']">
                {{ config.apiKey ? '已配置' : '未配置' }}
              </span>
              <span v-if="config.isPreset" class="preset-badge">预设</span>
            </div>
          </div>
          <div class="card-actions">
            <button @click.stop="editConfig(config)" class="btn-small">编辑</button>
            <button @click.stop="testConfig(config)" class="btn-small">测试</button>
            <button v-if="!config.isPreset" @click.stop="deleteConfig(config.id)" class="btn-small btn-danger">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 配置编辑对话框 -->
    <div v-if="showConfigDialog" class="modal-overlay" @click="closeConfigDialog">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ editingConfig ? '编辑配置' : '新建配置' }}</h3>
          <button @click="closeConfigDialog" class="btn-close">✕</button>
        </div>

        <div class="modal-body">
          <form @submit.prevent="saveConfig">
            <div class="form-group">
              <label>配置名称 *</label>
              <input v-model="configForm.name" type="text" required placeholder="例如: 我的GPT配置">
            </div>

            <div class="form-group">
              <label>提供商</label>
              <select v-model="configForm.provider">
                <option value="OpenAI">OpenAI</option>
                <option value="Alibaba">阿里云</option>
                <option value="Anthropic">Anthropic</option>
                <option value="Custom">自定义</option>
              </select>
            </div>

            <div class="form-group">
              <label>Base URL *</label>
              <input v-model="configForm.baseURL" type="url" required
                     placeholder="例如: https://api.openai.com/v1">
            </div>

            <div class="form-group">
              <label>模型名称 *</label>
              <input v-model="configForm.model" type="text" required
                     placeholder="例如: gpt-3.5-turbo">
            </div>

            <div class="form-group">
              <label>API Key *</label>
              <input v-model="configForm.apiKey" type="password" required
                     placeholder="输入您的API Key">
            </div>

            <div class="form-group">
              <label>描述</label>
              <textarea v-model="configForm.description"
                        placeholder="配置描述（可选）"></textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>最大Token数</label>
                <input v-model.number="configForm.maxTokens" type="number"
                       min="1" max="10000" placeholder="2000">
              </div>

              <div class="form-group">
                <label>Temperature</label>
                <input v-model.number="configForm.temperature" type="number"
                       min="0" max="2" step="0.1" placeholder="0.7">
              </div>

              <div class="form-group">
                <label>Top P</label>
                <input v-model.number="configForm.topP" type="number"
                       min="0" max="1" step="0.1" placeholder="0.9">
              </div>
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button @click="closeConfigDialog" class="btn-secondary">取消</button>
          <button @click="testConfigForm" class="btn-secondary" :disabled="testing">
            {{ testing ? '测试中...' : '测试连接' }}
          </button>
          <button @click="saveConfig" class="btn-primary">保存</button>
        </div>
      </div>
    </div>

    <!-- 导入对话框 -->
    <div v-if="showImportDialog" class="modal-overlay" @click="showImportDialog = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>导入配置</h3>
          <button @click="showImportDialog = false" class="btn-close">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>选择配置文件</label>
            <input type="file" @change="handleFileImport" accept=".json">
          </div>

          <div class="form-group">
            <label>或粘贴配置JSON</label>
            <textarea v-model="importText" placeholder="粘贴配置JSON数据"></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="showImportDialog = false" class="btn-secondary">取消</button>
          <button @click="importConfigs" class="btn-primary">导入</button>
        </div>
      </div>
    </div>

    <!-- 消息提示 -->
    <div v-if="message" class="message" :class="messageType">
      {{ message }}
    </div>
  </div>
</template>

<script>
import appConfigManager from './js/appConfigManager.js'

export default {
  name: 'LLMConfigPanel',
  data() {
    return {
      configs: [],
      currentConfig: null,
      selectedConfigId: '',
      showConfigDialog: false,
      showImportDialog: false,
      editingConfig: null,
      testing: false,
      message: '',
      messageType: 'info',
      importText: '',

      configForm: {
        name: '',
        provider: 'OpenAI',
        baseURL: '',
        model: '',
        apiKey: '',
        description: '',
        maxTokens: 2000,
        temperature: 0.7,
        topP: 0.9
      }
    }
  },

  mounted() {
    this.loadLlmConfigs()
  },

  methods: {
    // 加载配置
    loadLlmConfigs() {
      this.configs = appConfigManager.getAllLlmConfigs()
      this.currentConfig = appConfigManager.getCurrentLlmConfig()
      this.selectedConfigId = this.currentConfig?.id || ''
    },

    // 选择配置
    selectConfig(configId) {
      // This method just updates local state, then switchConfig is called on @change
      this.selectedConfigId = configId;
      // To make card click also switch:
      // this.switchConfig(); 
    },

    // 切换配置
    switchConfig() {
      try {
        const config = appConfigManager.switchLlmConfig(this.selectedConfigId)
        this.currentConfig = config
        this.showMessage('LLM配置切换成功', 'success')
        this.$emit('config-changed', config) // Notify parent about the change
      } catch (error) {
        this.showMessage(`切换LLM配置失败: ${error.message}`, 'error')
      }
    },

    // 编辑配置
    editConfig(config) {
      this.editingConfig = config
      this.configForm = {
        name: config.name,
        provider: config.provider,
        baseURL: config.baseURL,
        model: config.model,
        apiKey: config.apiKey,
        description: config.description,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        topP: config.topP
      }
      this.showConfigDialog = true
    },

    // 保存配置
    saveConfig() {
      try {
        const errors = appConfigManager.validateLlmConfig(this.configForm)
        if (errors.length > 0) {
          this.showMessage(`LLM配置验证失败: ${errors.join(', ')}`, 'error')
          return
        }

        if (this.editingConfig) {
          appConfigManager.updateLlmConfig(this.editingConfig.id, this.configForm)
          this.showMessage('LLM配置更新成功', 'success')
        } else {
          appConfigManager.createLlmConfig(this.configForm)
          this.showMessage('LLM配置创建成功', 'success')
        }

        this.loadLlmConfigs() // Reload all LLM configs
        // Check if the saved/updated config is the current one and emit if necessary
        const savedConfig = this.editingConfig ? appConfigManager.getLlmConfig(this.editingConfig.id) : appConfigManager.getLlmConfig(this.configForm.id);
        if (savedConfig && savedConfig.id === this.selectedConfigId) {
             this.currentConfig = savedConfig; // Update currentConfig details shown in UI
             this.$emit('config-changed', savedConfig);
        }
        this.closeConfigDialog()

      } catch (error) {
        this.showMessage(`保存LLM配置失败: ${error.message}`, 'error')
      }
    },

    // 删除配置
    deleteConfig(configId) {
      if (confirm('确定要删除这个LLM配置吗？')) {
        try {
          appConfigManager.deleteLlmConfig(configId)
          this.loadLlmConfigs() // Reload configs
          this.showMessage('LLM配置删除成功', 'success')
           // If the deleted config was the current one, onConfigChanged might need to be emitted
          if (this.currentConfig?.id === configId) {
            this.currentConfig = appConfigManager.getCurrentLlmConfig(); // Get the new current
            this.selectedConfigId = this.currentConfig?.id || '';
            this.$emit('config-changed', this.currentConfig);
          }
        } catch (error) {
          this.showMessage(`删除LLM配置失败: ${error.message}`, 'error')
        }
      }
    },

    // 测试当前配置
    async testCurrentConfig() {
      if (!this.currentConfig) {
        this.showMessage('没有选择配置', 'error')
        return
      }

      await this.testConfig(this.currentConfig)
    },

    // 测试配置
    async testConfig(config) {
      this.testing = true
      try {
        const result = await appConfigManager.testLlmConfig(config)
        if (result.success) {
          this.showMessage('LLM连接测试成功', 'success')
        } else {
          this.showMessage(result.message, 'error')
        }
      } catch (error) {
        this.showMessage(`LLM测试失败: ${error.message}`, 'error')
      } finally {
        this.testing = false
      }
    },

    // 测试表单配置
    async testConfigForm() {
      const errors = appConfigManager.validateLlmConfig(this.configForm)
      if (errors.length > 0) {
        this.showMessage(`LLM配置验证失败: ${errors.join(', ')}`, 'error')
        return
      }

      await this.testConfig(this.configForm)
    },

    // 导出配置
    exportConfigs() {
      try {
        const exportData = appConfigManager.exportLlmConfigs()
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `wps-ai-configs-${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
        this.showMessage('配置导出成功', 'success')
      } catch (error) {
        this.showMessage(`导出失败: ${error.message}`, 'error')
      }
    },

    // 处理文件导入
    handleFileImport(event) {
      const file = event.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          this.importText = e.target.result
        }
        reader.readAsText(file)
      }
    },

    // 导入配置
    importConfigs() {
      try {
        if (!this.importText.trim()) {
          this.showMessage('请选择文件或输入LLM配置数据', 'error')
          return
        }

        const importData = JSON.parse(this.importText)
        const result = appConfigManager.importLlmConfigs(importData)

        if (result.success) {
          this.loadLlmConfigs() // Reload configs
          this.showImportDialog = false
          this.importText = ''
          this.showMessage(`成功导入 ${result.importCount} 个LLM配置`, 'success')
        } else {
          this.showMessage(`导入LLM配置失败: ${result.error}`, 'error')
        }

      } catch (error) {
        this.showMessage(`导入LLM配置失败: ${error.message}`, 'error')
      }
    },

    // 关闭配置对话框
    closeConfigDialog() {
      this.showConfigDialog = false
      this.editingConfig = null
      this.configForm = {
        name: '',
        provider: 'OpenAI',
        baseURL: '',
        model: '',
        apiKey: '',
        description: '',
        maxTokens: 2000,
        temperature: 0.7,
        topP: 0.9
      }
    },

    // 显示消息
    showMessage(text, type = 'info') {
      this.message = text
      this.messageType = type
      setTimeout(() => {
        this.message = ''
      }, 3000)
    }
  }
}
</script>

<style scoped>
.llm-config-panel {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  max-height: 80vh;
  overflow-y: auto;
}

/* 配置选择器 */
.config-selector {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.selector-header h3 {
  margin: 0;
  color: #333;
}

.selector-actions {
  display: flex;
  gap: 10px;
}

.current-config {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
}

.current-config label {
  font-weight: 600;
  color: #555;
}

.config-select {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
}

.config-details {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 15px;
  background: #f0f7ff;
  border-radius: 6px;
  border-left: 4px solid #007bff;
}

.config-info {
  flex: 1;
}

.info-item {
  display: flex;
  margin-bottom: 8px;
}

.info-item .label {
  font-weight: 600;
  color: #555;
  width: 80px;
  flex-shrink: 0;
}

.info-item .value {
  color: #333;
  word-break: break-all;
}

.config-actions {
  display: flex;
  gap: 10px;
}

/* 配置列表 */
.config-list h4 {
  margin-bottom: 15px;
  color: #333;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 15px;
}

.config-card {
  background: white;
  border-radius: 8px;
  padding: 15px;
  border: 2px solid #e9ecef;
  cursor: pointer;
  transition: all 0.2s ease;
}

.config-card:hover {
  border-color: #007bff;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.config-card.active {
  border-color: #007bff;
  background: #f0f7ff;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.card-header h5 {
  margin: 0;
  color: #333;
}

.provider-badge {
  background: #6c757d;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.card-body .model {
  font-family: monospace;
  background: #f8f9fa;
  padding: 4px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
  font-size: 14px;
}

.card-body .description {
  color: #666;
  font-size: 14px;
  margin-bottom: 10px;
  line-height: 1.4;
}

.status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.status-indicator {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-indicator.configured {
  background: #d4edda;
  color: #155724;
}

.status-indicator.not-configured {
  background: #f8d7da;
  color: #721c24;
}

.preset-badge {
  background: #e2e3e5;
  color: #495057;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.card-actions {
  display: flex;
  gap: 8px;
}

/* 按钮样式 */
.btn-primary, .btn-secondary, .btn-edit, .btn-delete, .btn-test, .btn-small {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

.btn-edit {
  background: #28a745;
  color: white;
}

.btn-edit:hover {
  background: #1e7e34;
}

.btn-delete, .btn-danger {
  background: #dc3545;
  color: white;
}

.btn-delete:hover, .btn-danger:hover {
  background: #c82333;
}

.btn-test {
  background: #17a2b8;
  color: white;
}

.btn-test:hover {
  background: #138496;
}

.btn-small {
  padding: 4px 8px;
  font-size: 12px;
  background: #f8f9fa;
  color: #495057;
  border: 1px solid #dee2e6;
}

.btn-small:hover {
  background: #e9ecef;
}

.btn-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #999;
}

.btn-close:hover {
  color: #333;
}

/* 模态框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #dee2e6;
}

.modal-header h3 {
  margin: 0;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px;
  border-top: 1px solid #dee2e6;
}

/* 表单样式 */
.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 600;
  color: #555;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group textarea {
  height: 80px;
  resize: vertical;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 15px;
}

/* 消息提示 */
.message {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 20px;
  border-radius: 4px;
  color: white;
  font-weight: 600;
  z-index: 1001;
  animation: slideIn 0.3s ease;
}

.message.success {
  background: #28a745;
}

.message.error {
  background: #dc3545;
}

.message.info {
  background: #17a2b8;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* 图标 */
.icon {
  font-style: normal;
}

/* 响应式 */
@media (max-width: 768px) {
  .config-grid {
    grid-template-columns: 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .current-config {
    flex-direction: column;
    align-items: stretch;
  }

  .config-details {
    flex-direction: column;
    gap: 15px;
  }

  .selector-header {
    flex-direction: column;
    gap: 15px;
  }

  .selector-actions {
    width: 100%;
    justify-content: center;
  }
}
</style>
