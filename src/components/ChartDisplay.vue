<template>
  <div ref="chartDom" class="chart-container"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, ScatterChart, RadarChart, SankeyChart, FunnelChart, GaugeChart, PictorialBarChart, ThemeRiverChart, SunburstChart, TreeChart, TreemapChart, GraphChart, BoxplotChart, CandlestickChart, HeatmapChart, MapChart, ParallelChart, LinesChart, EffectScatterChart, CustomChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, GridComponent, LegendComponent, ToolboxComponent, DataZoomComponent, VisualMapComponent, TimelineComponent, CalendarComponent, GraphicComponent, AriaComponent, DatasetComponent, TransformComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// 按需引入 ECharts 组件
echarts.use([
  TitleComponent, TooltipComponent, GridComponent, LegendComponent, ToolboxComponent, DataZoomComponent, VisualMapComponent, TimelineComponent, CalendarComponent, GraphicComponent, AriaComponent, DatasetComponent, TransformComponent,
  BarChart, LineChart, PieChart, ScatterChart, RadarChart, SankeyChart, FunnelChart, GaugeChart, PictorialBarChart, ThemeRiverChart, SunburstChart, TreeChart, TreemapChart, GraphChart, BoxplotChart, CandlestickChart, HeatmapChart, MapChart, ParallelChart, LinesChart, EffectScatterChart, CustomChart,
  CanvasRenderer
]);

const props = defineProps({
  option: {
    type: Object,
    required: true,
    default: () => ({})
  },
  theme: {
    type: String,
    default: null // null 表示使用默认主题，也可以传入 'dark' 等
  },
  width: {
    type: String,
    default: '100%'
  },
  height: {
    type: String,
    default: '400px' // 默认高度
  }
});

const chartDom = ref(null);
let chartInstance = null;

const initChart = () => {
  console.log('[ChartDisplay] initChart called. DOM ref:', chartDom.value);
  if (chartDom.value) {
    if (chartInstance) {
      console.log('[ChartDisplay] Disposing existing chart instance.');
      chartInstance.dispose();
    }
    console.log('[ChartDisplay] Initializing new ECharts instance with theme:', props.theme);
    chartInstance = echarts.init(chartDom.value, props.theme);
    console.log('[ChartDisplay] ECharts instance created:', chartInstance);
    
    if (props.option && Object.keys(props.option).length > 0) {
      console.log('[ChartDisplay] Setting initial option:', JSON.parse(JSON.stringify(props.option)));
      try {
        chartInstance.setOption(props.option);
        console.log('[ChartDisplay] Initial option set successfully.');
      } catch (e) {
        console.error('[ChartDisplay] Error setting initial option:', e, props.option);
      }
    } else {
      console.log('[ChartDisplay] Initial option is empty or invalid.');
    }
  } else {
    console.warn('[ChartDisplay] chartDom is not available in initChart.');
  }
};

const resizeChart = () => {
  if (chartInstance) {
    chartInstance.resize();
  }
};

onMounted(() => {
  nextTick(() => {
    initChart();
  });
  window.addEventListener('resize', resizeChart);
});

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }
  window.removeEventListener('resize', resizeChart);
});

watch(() => props.option, (newOption, oldOption) => {
  console.log('[ChartDisplay] Option prop changed. New option:', JSON.parse(JSON.stringify(newOption)), 'Old option:', JSON.parse(JSON.stringify(oldOption)));
  if (chartInstance) {
    if (newOption && Object.keys(newOption).length > 0) {
      console.log('[ChartDisplay] Applying new option to chart instance.');
      try {
        chartInstance.setOption(newOption, { notMerge: true, lazyUpdate: false }); // notMerge: true, lazyUpdate: false for immediate update
        console.log('[ChartDisplay] New option applied successfully.');
      } catch (e) {
        console.error('[ChartDisplay] Error applying new option:', e, newOption);
      }
    } else {
      console.log('[ChartDisplay] New option is empty, clearing chart.');
      chartInstance.clear();
    }
  } else if (newOption && Object.keys(newOption).length > 0) {
    // 如果图表实例不存在但有option（例如，DOM可能延迟创建或首次加载时option已存在），尝试重新初始化
    console.log('[ChartDisplay] Chart instance not found, but new option received. Attempting to re-initialize.');
    nextTick(() => {
        initChart();
    });
  }
}, { deep: true });

watch([() => props.width, () => props.height], () => {
  if (chartDom.value) {
    chartDom.value.style.width = props.width;
    chartDom.value.style.height = props.height;
  }
  resizeChart();
});

// 可以选择性地暴露一些方法，例如手动resize
defineExpose({
  resizeChart,
  getInstance: () => chartInstance
});

</script>

<style scoped>
.chart-container {
  width: 100%; /* 默认宽度，会被props覆盖 */
  height: 400px; /* 默认高度，会被props覆盖 */
}
</style>
