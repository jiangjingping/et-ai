<template>
  <div class="agent-test">
    <h2>🧪 Agent 系统测试</h2>
    
    <div class="test-section">
      <h3>初始化状态</h3>
      <p>Agent 初始化状态: {{ isAgentInitialized ? '✅ 已初始化' : '⏳ 初始化中...' }}</p>
      <button @click="checkLLMConfig" :disabled="isLoading">检查 LLM 配置</button>
      <div v-if="llmConfigStatus" class="config-status">
        <p><strong>LLM 配置状态:</strong> {{ llmConfigStatus }}</p>
      </div>
    </div>

    <div class="test-section">
      <h3>工具测试</h3>
      <button @click="testGeneralQA" :disabled="isLoading">测试通用问答</button>
      <button @click="testTableQA" :disabled="isLoading">测试表格问答</button>
      <button @click="testSimpleChart" :disabled="isLoading">测试简易图表</button>
      <button @click="testAdvancedAnalytics" :disabled="isLoading">测试高级分析</button>
    </div>

    <div class="test-section" v-if="testResults.length > 0">
      <h3>测试结果</h3>
      <div v-for="(result, index) in testResults" :key="index" class="test-result">
        <h4>{{ result.testName }}</h4>
        <p><strong>状态:</strong> {{ result.success ? '✅ 成功' : '❌ 失败' }}</p>
        <p><strong>工具:</strong> {{ result.tool }}</p>
        <p><strong>响应时间:</strong> {{ result.duration }}ms</p>
        <div v-if="result.error" class="error">
          <strong>错误:</strong> {{ result.error }}
        </div>
        <div v-if="result.data" class="result-data">
          <strong>结果:</strong>
          <pre>{{ JSON.stringify(result.data, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <div v-if="isLoading" class="loading">
      <p>🔄 测试进行中...</p>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { IntentAgent } from './js/agents/intentAgent.js'
import { initializeTools } from './js/tools/index.js'
import appConfigManager from './js/appConfigManager.js'

export default {
  name: 'AgentTest',
  setup() {
    const isAgentInitialized = ref(false)
    const isLoading = ref(false)
    const testResults = ref([])
    const intentAgent = ref(null)
    const llmConfigStatus = ref('')

    const initializeAgent = async () => {
      try {
        console.log('Initializing Agent system for testing...')
        
        // 初始化所有工具
        await initializeTools()
        
        // 创建意图分析 Agent
        intentAgent.value = new IntentAgent()
        await intentAgent.value.initialize()
        
        isAgentInitialized.value = true
        console.log('Agent system initialized successfully for testing')
        
      } catch (error) {
        console.error('Failed to initialize Agent system:', error)
        testResults.value.push({
          testName: 'Agent 初始化',
          success: false,
          tool: 'System',
          duration: 0,
          error: error.message
        })
      }
    }

    const runTest = async (testName, userInput, tableData = null) => {
      if (!intentAgent.value) {
        testResults.value.push({
          testName,
          success: false,
          tool: 'Unknown',
          duration: 0,
          error: 'Agent not initialized'
        })
        return
      }

      isLoading.value = true
      const startTime = Date.now()

      try {
        const response = await intentAgent.value.process(userInput, tableData, {
          isTableContextAttached: !!tableData,
          timestamp: new Date().toISOString()
        })

        const duration = Date.now() - startTime

        testResults.value.push({
          testName,
          success: response.success,
          tool: response.data?.tool || 'Unknown',
          duration,
          data: response.data,
          error: response.success ? null : response.error
        })

      } catch (error) {
        const duration = Date.now() - startTime
        testResults.value.push({
          testName,
          success: false,
          tool: 'Unknown',
          duration,
          error: error.message
        })
      } finally {
        isLoading.value = false
      }
    }

    const testGeneralQA = () => {
      runTest('通用问答测试', '你好，请介绍一下自己')
    }

    const testTableQA = () => {
      const mockTableData = [
        { 姓名: '张三', 年龄: 25, 城市: '北京' },
        { 姓名: '李四', 年龄: 30, 城市: '上海' },
        { 姓名: '王五', 年龄: 28, 城市: '广州' }
      ]
      runTest('表格问答测试', '这个表格有多少行数据？', mockTableData)
    }

    const testSimpleChart = () => {
      const mockTableData = [
        { 月份: '1月', 销售额: 1000 },
        { 月份: '2月', 销售额: 1200 },
        { 月份: '3月', 销售额: 1100 }
      ]
      runTest('简易图表测试', '请用柱状图展示销售额数据', mockTableData)
    }

    const testAdvancedAnalytics = () => {
      const mockTableData = [
        { x: 1, y: 2, z: 3 },
        { x: 2, y: 4, z: 6 },
        { x: 3, y: 6, z: 9 },
        { x: 4, y: 8, z: 12 }
      ]
      runTest('高级分析测试', '分析x和y之间的相关性', mockTableData)
    }

    const checkLLMConfig = () => {
      try {
        const config = appConfigManager.getCurrentLlmConfig()
        console.log('当前 LLM 配置:', config)

        if (!config) {
          llmConfigStatus.value = '❌ 未找到 LLM 配置'
        } else if (!config.apiKey) {
          llmConfigStatus.value = '❌ LLM API Key 未设置'
        } else if (!config.baseURL) {
          llmConfigStatus.value = '❌ LLM Base URL 未设置'
        } else {
          llmConfigStatus.value = `✅ LLM 配置正常 (${config.name})`
        }
      } catch (error) {
        console.error('检查 LLM 配置失败:', error)
        llmConfigStatus.value = `❌ 检查配置失败: ${error.message}`
      }
    }

    onMounted(() => {
      initializeAgent()
    })

    return {
      isAgentInitialized,
      isLoading,
      testResults,
      llmConfigStatus,
      testGeneralQA,
      testTableQA,
      testSimpleChart,
      testAdvancedAnalytics,
      checkLLMConfig
    }
  }
}
</script>

<style scoped>
.agent-test {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.test-section {
  margin: 20px 0;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.test-section h3 {
  margin-top: 0;
  color: #333;
}

.test-section button {
  margin: 5px;
  padding: 8px 16px;
  background: #007acc;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.test-section button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.test-section button:hover:not(:disabled) {
  background: #005a9e;
}

.test-result {
  margin: 15px 0;
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 6px;
  background: #f9f9f9;
}

.test-result h4 {
  margin-top: 0;
  color: #333;
}

.error {
  color: #d32f2f;
  background: #ffebee;
  padding: 8px;
  border-radius: 4px;
  margin: 8px 0;
}

.result-data {
  margin: 8px 0;
}

.result-data pre {
  background: #f5f5f5;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
}

.loading {
  text-align: center;
  color: #666;
  font-style: italic;
}

.config-status {
  margin-top: 10px;
  padding: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  font-size: 14px;
}
</style>
