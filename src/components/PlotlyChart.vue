<template>
  <div ref="plotEl" class="plotly-chart-container"></div>
</template>

<script>
import { ref, onMounted, watch } from 'vue';
import Plotly from 'plotly.js-dist-min';

export default {
  name: 'PlotlyChart',
  props: {
    spec: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const plotEl = ref(null);

    const renderPlot = () => {
      if (plotEl.value && props.spec) {
        // 关键修复：创建 props.spec 的深拷贝副本，以防止 Plotly 修改原始响应式对象
        // 这可以避免 "Maximum recursive updates exceeded" 错误
        const specCopy = JSON.parse(JSON.stringify(props.spec));
        Plotly.newPlot(plotEl.value, specCopy.data, specCopy.layout);
      }
    };

    onMounted(() => {
      renderPlot();
    });

    watch(() => props.spec, () => {
      renderPlot();
    }, { deep: true });

    return {
      plotEl,
    };
  },
};
</script>

<style scoped>
.plotly-chart-container {
  width: 100%;
  height: 400px; /* Or adjust as needed */
}
</style>
