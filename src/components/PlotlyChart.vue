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
        Plotly.newPlot(plotEl.value, props.spec.data, props.spec.layout);
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
