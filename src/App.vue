<template>
  <RouterView />
</template>

<style scoped></style>

<script>
import { ref, onMounted } from 'vue'

export default {
  setup() {
    const message = ref('你好，wps加载项')
    onMounted(() => {
      // 仅在WPS环境内执行与Ribbon相关的逻辑
      if (typeof wps !== 'undefined' && wps.EtApplication) {
        import('./components/ribbon.js').then(ribbonModule => {
          window.ribbon = ribbonModule.default;
          // 如果需要，可以在这里手动触发一个初始化函数
          // 例如: ribbonModule.default.OnAddinLoad(wps.Application.ribbonUI);
          // 但通常 OnAddinLoad 是由WPS宿主自动调用的。
        }).catch(err => {
          console.error("加载 ribbon.js 失败:", err);
        });
      } else {
        console.log("非WPS环境，不加载Ribbon。");
      }
    })

    return {
      message
    }
  }
}
</script>
