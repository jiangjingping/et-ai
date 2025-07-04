<template>
  <div ref="chartEl" class="echarts-chart-container"></div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
// 修复：直接导入完整的 ECharts 包，以支持所有图表类型
import * as echarts from 'echarts';

export default {
  name: 'EChartsChart',
  props: {
    option: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const chartEl = ref(null);
    let chartInstance = null;

    // 渲染图表的函数
    const renderChart = () => {
      if (chartEl.value) {
        // 初始化 ECharts 实例
        chartInstance = echarts.init(chartEl.value);
        // 设置图表配置
        chartInstance.setOption(props.option);
      }
    };

    // 更新图表的函数
    const updateChart = () => {
      if (chartInstance) {
        chartInstance.setOption(props.option, true); // true 表示不与之前的 option 合并
      }
    };

    // 监听 option 变化，并更新图表
    watch(() => props.option, (newOption) => {
      if (newOption) {
        nextTick(() => {
          updateChart();
        });
      }
    }, { deep: true });

    // 组件挂载时渲染图表
    onMounted(() => {
      nextTick(() => {
        renderChart();
      });
    });

    // 组件卸载时销毁实例，释放资源
    onUnmounted(() => {
      if (chartInstance) {
        chartInstance.dispose();
      }
    });

    return {
      chartEl,
    };
  },
};
</script>

<style scoped>
.echarts-chart-container {
  width: 100%;
  height: 400px; /* 可根据需要调整 */
}
</style>
