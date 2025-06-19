import { createRouter, createWebHashHistory } from 'vue-router'
//import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history:  createWebHashHistory(''),
  routes: [
    {
      path: '/',
      name: '默认页',
      component: () => import('../components/Root.vue')
    },
    {
      path: '/ai-chat',
      name: 'AI对话助手',
      component: () => import('../components/AIChatPanel.vue')
    },
    {
      path: '/agent-test',
      name: 'Agent测试',
      component: () => import('../components/AgentTest.vue')
    }
  ]
})

export default router
