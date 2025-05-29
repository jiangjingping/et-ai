// AI对话面板管理器
class AIChatManager {
    constructor() {
        this.isVisible = false
        this.panelElement = null
        this.taskPaneId = null
    }

    // 显示AI对话面板
    async showChatPanel() {
        try {
            // 检查是否已经存在对话面板
            if (this.taskPaneId) {
                const existingPane = window.Application.GetTaskPane(this.taskPaneId)
                if (existingPane) {
                    existingPane.Visible = true
                    this.isVisible = true
                    return
                }
            }

            // 创建新的任务窗格
            const chatUrl = this.getChatPanelUrl()
            const taskPane = window.Application.CreateTaskPane(chatUrl)
            
            if (taskPane) {
                this.taskPaneId = taskPane.ID
                
                // 设置任务窗格属性
                taskPane.Visible = true
                taskPane.Width = 400 // 设置宽度为400像素
                taskPane.DockPosition = window.Application.Enum.msoCTPDockPositionRight // 停靠在右侧
                taskPane.Title = "AI智能助手"
                
                this.isVisible = true
                
                // 保存任务窗格ID到本地存储
                window.Application.PluginStorage.setItem("ai_chat_panel_id", this.taskPaneId)
                
                console.log('AI对话面板创建成功')
            } else {
                throw new Error('创建任务窗格失败')
            }
        } catch (error) {
            console.error('显示AI对话面板失败:', error)
            // 如果任务窗格创建失败，回退到对话框模式
            this.showChatDialog()
        }
    }

    // 隐藏AI对话面板
    hideChatPanel() {
        try {
            if (this.taskPaneId) {
                const taskPane = window.Application.GetTaskPane(this.taskPaneId)
                if (taskPane) {
                    taskPane.Visible = false
                    this.isVisible = false
                }
            }
        } catch (error) {
            console.error('隐藏AI对话面板失败:', error)
        }
    }

    // 切换AI对话面板显示状态
    toggleChatPanel() {
        if (this.isVisible) {
            this.hideChatPanel()
        } else {
            this.showChatPanel()
        }
    }

    // 关闭AI对话面板
    closeChatPanel() {
        try {
            if (this.taskPaneId) {
                const taskPane = window.Application.GetTaskPane(this.taskPaneId)
                if (taskPane) {
                    taskPane.Delete()
                }
                this.taskPaneId = null
                this.isVisible = false
                
                // 清除本地存储
                window.Application.PluginStorage.removeItem("ai_chat_panel_id")
            }
        } catch (error) {
            console.error('关闭AI对话面板失败:', error)
        }
    }

    // 获取对话面板URL
    getChatPanelUrl() {
        // 获取基础URL
        const baseUrl = this.getBaseUrl()
        const routerHash = this.getRouterHash()
        return `${baseUrl}${routerHash}/ai-chat`
    }

    // 获取基础URL
    getBaseUrl() {
        if (window.location.protocol === 'file:') {
            const path = window.location.href
            return path.substring(0, path.lastIndexOf('/'))
        }
        
        const { protocol, hostname, port } = window.location
        const portPart = port ? `:${port}` : ''
        return `${protocol}//${hostname}${portPart}`
    }

    // 获取路由哈希
    getRouterHash() {
        if (window.location.protocol === 'file:') {
            return ''
        }
        return '/#'
    }

    // 回退方案：显示对话框模式的AI助手
    showChatDialog() {
        try {
            const chatUrl = this.getChatPanelUrl()
            window.Application.ShowDialog(
                chatUrl, 
                "AI智能助手", 
                500 * window.devicePixelRatio, 
                700 * window.devicePixelRatio, 
                false
            )
        } catch (error) {
            console.error('显示AI对话框失败:', error)
            alert('无法打开AI助手，请检查插件配置')
        }
    }

    // 检查面板是否可见
    isVisible() {
        return this.isVisible
    }

    // 初始化管理器
    initialize() {
        try {
            // 尝试恢复之前的任务窗格
            const savedId = window.Application.PluginStorage.getItem("ai_chat_panel_id")
            if (savedId) {
                try {
                    const taskPane = window.Application.GetTaskPane(savedId)
                    if (taskPane) {
                        this.taskPaneId = savedId
                        this.isVisible = taskPane.Visible
                    } else {
                        // 如果任务窗格不存在，清除保存的ID
                        window.Application.PluginStorage.removeItem("ai_chat_panel_id")
                    }
                } catch (error) {
                    // 任务窗格可能已被删除，清除保存的ID
                    window.Application.PluginStorage.removeItem("ai_chat_panel_id")
                }
            }
        } catch (error) {
            console.error('初始化AI对话管理器失败:', error)
        }
    }

    // 发送消息到对话面板（如果需要外部控制）
    sendMessageToPanel(message) {
        try {
            if (this.taskPaneId) {
                const taskPane = window.Application.GetTaskPane(this.taskPaneId)
                if (taskPane && taskPane.Visible) {
                    // 这里可以通过postMessage或其他方式与面板通信
                    // 具体实现取决于WPS的API支持
                    console.log('发送消息到AI面板:', message)
                }
            }
        } catch (error) {
            console.error('发送消息到AI面板失败:', error)
        }
    }

    // 获取当前表格数据并发送到AI面板
    analyzeCurrentTable() {
        try {
            // 显示面板（如果未显示）
            if (!this.isVisible) {
                this.showChatPanel()
            }

            // 这里可以添加自动分析当前表格的逻辑
            // 例如自动发送"分析当前表格数据"的消息
            setTimeout(() => {
                this.sendMessageToPanel("请分析当前表格数据")
            }, 1000)
        } catch (error) {
            console.error('分析当前表格失败:', error)
        }
    }

    // 清理资源
    cleanup() {
        try {
            this.closeChatPanel()
        } catch (error) {
            console.error('清理AI对话管理器失败:', error)
        }
    }
}

// 创建全局实例
const aiChatManager = new AIChatManager()

// 在插件加载时初始化
if (typeof window !== 'undefined' && window.Application) {
    aiChatManager.initialize()
}

export default aiChatManager
