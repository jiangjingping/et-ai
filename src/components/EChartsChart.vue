<template>
  <div ref="chartEl" class="echarts-chart-container"></div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import * as echarts from 'echarts/core';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components';
import { BarChart, LineChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';

// 按需引入 ECharts 组件
echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  BarChart,
  LineChart,
  CanvasRenderer,
]);

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
