<template>
  <div class="root-container">
    <div class="header">
      <h1>🚀 WPS-AI 智能表格助手</h1>
      <p>基于大语言模型的智能表格处理工具集</p>
    </div>

    <div class="navigation-grid">
      <router-link to="/ai-chat" class="nav-card">
        <div class="nav-icon">💬</div>
        <h3>AI对话助手</h3>
        <p>自然语言表格操作</p>
        <div class="nav-features">
          <span class="feature">对话交互</span>
          <span class="feature">智能筛选</span>
          <span class="feature">流式输出</span>
        </div>
      </router-link>

    </div>

    <div class="footer">
      <p>💡 提示：点击上方卡片访问不同功能模块</p>
      <p>🔧 新功能：AI智能体管理面板，支持记忆管理和性能监控</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'HelloWps',
  data() {
    return {
      msg: '欢迎来到wps加载项的世界!'
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.root-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.header {
  text-align: center;
  margin-bottom: 40px;
  color: white;
}

.header h1 {
  font-size: 2.5rem;
  margin-bottom: 10px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.header p {
  font-size: 1.2rem;
  opacity: 0.9;
  margin: 0;
}

.navigation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  max-width: 1200px;
  margin: 0 auto 40px auto;
}

.nav-card {
  background: white;
  border-radius: 12px;
  padding: 25px;
  text-decoration: none;
  color: inherit;
  box-shadow: 0 8px 25px rgba(0,0,0,0.15);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.nav-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 35px rgba(0,0,0,0.2);
}

.nav-card.featured {
  border: 2px solid #e74c3c;
  background: linear-gradient(135deg, #fff 0%, #fff5f5 100%);
}

.nav-card.featured:hover {
  border-color: #c0392b;
  background: linear-gradient(135deg, #fff 0%, #ffebeb 100%);
}

.nav-icon {
  font-size: 3rem;
  text-align: center;
  margin-bottom: 15px;
}

.nav-card h3 {
  margin: 0 0 10px 0;
  color: #2c3e50;
  font-size: 1.4rem;
  text-align: center;
}

.nav-card p {
  color: #7f8c8d;
  text-align: center;
  margin: 0 0 15px 0;
  line-height: 1.5;
}

.nav-features {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.feature {
  background: #ecf0f1;
  color: #34495e;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.nav-card.featured .feature {
  background: #fadbd8;
  color: #c0392b;
}

.new-badge {
  position: absolute;
  top: 15px;
  right: 15px;
  background: #e74c3c;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.footer {
  text-align: center;
  color: white;
  opacity: 0.8;
  max-width: 800px;
  margin: 0 auto;
}

.footer p {
  margin: 10px 0;
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .root-container {
    padding: 15px;
  }

  .header h1 {
    font-size: 2rem;
  }

  .header p {
    font-size: 1rem;
  }

  .navigation-grid {
    grid-template-columns: 1fr;
    gap: 15px;
  }

  .nav-card {
    padding: 20px;
  }

  .nav-icon {
    font-size: 2.5rem;
  }

  .nav-card h3 {
    font-size: 1.2rem;
  }
}

@media (max-width: 480px) {
  .header h1 {
    font-size: 1.8rem;
  }

  .nav-card {
    padding: 15px;
  }

  .nav-icon {
    font-size: 2rem;
  }
}
</style>
