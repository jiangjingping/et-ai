<template>
  <div class="advanced-chart-display">
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>正在生成高级图表...</p>
    </div>
    
    <div v-else-if="error" class="error-container">
      <div class="error-icon">⚠️</div>
      <p class="error-message">{{ error }}</p>
      <button @click="retry" class="retry-btn">重试</button>
    </div>
    
    <div v-else class="chart-container">
      <div class="chart-header" v-if="title">
        <h3>{{ title }}</h3>
        <div class="chart-actions">
          <button @click="downloadChart" class="action-btn" title="下载图表">📥</button>
          <button @click="fullscreen" class="action-btn" title="全屏显示">🔍</button>
        </div>
      </div>
      
      <div 
        ref="plotlyContainer" 
        :id="containerId"
        class="plotly-chart"
        :style="{ height: chartHeight + 'px' }"
      ></div>
      
      <div class="chart-info" v-if="showInfo">
        <p class="chart-description">{{ description }}</p>
        <div class="chart-stats">
          <span>数据点: {{ dataPoints }}</span>
          <span>图表类型: {{ chartType }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

export default {
  name: 'AdvancedChartDisplay',
  props: {
    plotlyConfig: {
      type: Object,
      required: true
    },
    title: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    height: {
      type: Number,
      default: 400
    },
    showInfo: {
      type: Boolean,
      default: true
    }
  },
  emits: ['chart-ready', 'chart-error', 'chart-click'],
  setup(props, { emit }) {
    const plotlyContainer = ref(null)
    const loading = ref(true)
    const error = ref(null)
    const containerId = ref(`plotly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    const chartHeight = ref(props.height)
    const dataPoints = ref(0)
    const chartType = ref('unknown')

    let plotlyInstance = null
    let Plotly = null

    const loadPlotly = async () => {
      if (!Plotly) {
        try {
          Plotly = await import('plotly.js-dist')
        } catch (err) {
          console.error('Failed to load Plotly.js:', err)
          throw new Error('Failed to load Plotly.js library')
        }
      }
      return Plotly
    }

    const initChart = async () => {
      try {
        loading.value = true
        error.value = null

        // 等待DOM更新确保容器存在
        await nextTick();

        console.log('🔧 [DEBUG] AdvancedChartDisplay.initChart 开始')
        console.log('📊 [DEBUG] Plotly配置:', props.plotlyConfig)

        if (!props.plotlyConfig || !props.plotlyConfig.data) {
          throw new Error('Invalid Plotly configuration')
        }

        // 动态加载 Plotly.js
        console.log('📦 [DEBUG] 开始加载 Plotly.js...')
        const PlotlyLib = await loadPlotly()
        console.log('✅ [DEBUG] Plotly.js 加载成功')

        if (!plotlyContainer.value) {
          throw new Error('Chart container is not available in the DOM.');
        }
        
        console.log('✅ [DEBUG] 容器元素找到:', plotlyContainer.value)

        // 将Proxy对象转换为纯JS对象，增加第三方库兼容性
        const plotlyConfig = JSON.parse(JSON.stringify(props.plotlyConfig));

        const data = plotlyConfig.data || []
        const layout = {
          ...plotlyConfig.layout,
          responsive: true,
          autosize: true
        }
        const config = {
          responsive: true,
          displayModeBar: true,
          modeBarButtonsToRemove: ['pan2d', 'lasso2d'],
          ...plotlyConfig.config
        }

        console.log('📊 [DEBUG] 开始创建 Plotly 图表...')
        console.log('📈 [DEBUG] 数据:', data)
        console.log('🎨 [DEBUG] 布局:', layout)
        console.log('⚙️ [DEBUG] 配置:', config)

        plotlyInstance = await PlotlyLib.newPlot(
          plotlyContainer.value,
          data,
          layout,
          config
        )

        console.log('✅ [DEBUG] Plotly 图表创建成功')

        // 计算数据点数量
        dataPoints.value = data.reduce((total, trace) => {
          if (trace.x && Array.isArray(trace.x)) {
            return total + trace.x.length
          }
          if (trace.y && Array.isArray(trace.y)) {
            return total + trace.y.length
          }
          return total
        }, 0)

        // 确定图表类型
        chartType.value = data.length > 0 ? (data[0].type || 'scatter') : 'unknown'

        // 添加事件监听
        plotlyContainer.value.on('plotly_click', (eventData) => {
          emit('chart-click', eventData)
        })

        loading.value = false
        emit('chart-ready', plotlyInstance)

      } catch (err) {
        console.error('Failed to initialize Plotly chart:', err)
        error.value = err.message || 'Failed to create chart'
        loading.value = false
        emit('chart-error', err)
      }
    }

    const retry = () => {
      initChart()
    }

    const downloadChart = async () => {
      if (!plotlyInstance || !Plotly) return
      try {
        const filename = `chart-${Date.now()}.png`
        await Plotly.downloadImage(plotlyContainer.value, {
          format: 'png',
          width: 800,
          height: 600,
          filename: filename
        })
      } catch (err) {
        console.error('Failed to download chart:', err)
      }
    }

    const fullscreen = () => {
      if (!plotlyContainer.value) return
      if (plotlyContainer.value.requestFullscreen) {
        plotlyContainer.value.requestFullscreen()
      }
    }

    const updateChart = async () => {
      if (!plotlyInstance || !props.plotlyConfig || !Plotly) return
      try {
        // 等待DOM更新
        await nextTick();
        // 将Proxy对象转换为纯JS对象
        const plotlyConfig = JSON.parse(JSON.stringify(props.plotlyConfig));
        const data = plotlyConfig.data || []
        const layout = {
          ...plotlyConfig.layout,
          responsive: true,
          autosize: true
        }
        await Plotly.react(plotlyContainer.value, data, layout)
      } catch (err) {
        console.error('Failed to update chart:', err)
      }
    }

    const cleanup = () => {
      if (plotlyInstance && plotlyContainer.value && Plotly) {
        try {
          Plotly.purge(plotlyContainer.value)
          plotlyInstance = null
        } catch (err) {
          console.error('Failed to cleanup Plotly chart:', err)
        }
      }
    }

    // 监听配置变化
    watch(() => props.plotlyConfig, (newConfig) => {
      console.log('👀 [DEBUG] Plotly配置变化:', newConfig)
      // 仅在配置实际变化时更新图表
      if (newConfig && newConfig.data && plotlyInstance) {
          console.log('🔄 [DEBUG] 更新现有图表')
          updateChart()
      }
    }, { deep: true })

    // 监听高度变化
    watch(() => props.height, (newHeight) => {
      chartHeight.value = newHeight
      if (plotlyInstance && Plotly) {
        Plotly.relayout(plotlyContainer.value, { height: newHeight })
      }
    })

    onMounted(() => {
      console.log('🔧 [DEBUG] AdvancedChartDisplay 组件挂载')
      // 在DOM挂载后，如果配置有效，则初始化图表
      if (props.plotlyConfig && props.plotlyConfig.data) {
        // 使用 nextTick 确保即使在 onMounted 中，DOM 也已完全可用
        nextTick(() => {
            initChart();
        });
      } else {
        // 如果初始没有有效配置，则将加载状态设置为false
        loading.value = false;
      }
    })

    onUnmounted(() => {
      cleanup()
    })

    return {
      plotlyContainer,
      loading,
      error,
      containerId,
      chartHeight,
      dataPoints,
      chartType,
      retry,
      downloadChart,
      fullscreen
    }
  }
}
</script>

<style scoped>
.advanced-chart-display {
  width: 100%;
  margin: 16px 0;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  background: white;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #666;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007acc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #d32f2f;
}

.error-icon {
  font-size: 32px;
  margin-bottom: 16px;
}

.error-message {
  margin-bottom: 16px;
  text-align: center;
}

.retry-btn {
  padding: 8px 16px;
  background: #007acc;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.retry-btn:hover {
  background: #005a9e;
}

.chart-container {
  width: 100%;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.chart-header h3 {
  margin: 0;
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.chart-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 8px;
  background: transparent;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f0f0f0;
  border-color: #bbb;
}

.plotly-chart {
  width: 100%;
  min-height: 300px;
}

.chart-info {
  padding: 12px 16px;
  background: #f8f9fa;
  border-top: 1px solid #e0e0e0;
  font-size: 12px;
  color: #666;
}

.chart-description {
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.chart-stats {
  display: flex;
  gap: 16px;
}

.chart-stats span {
  padding: 2px 8px;
  background: #e3f2fd;
  border-radius: 12px;
  font-size: 11px;
}
</style>
