document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素 ---
    const chatContainer = document.getElementById('chat-container');
    const chartContainer = document.getElementById('chart-container');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const modeToggleButton = document.getElementById('mode-toggle-button');

    // --- 状态管理 ---
    let isAnalysisMode = false; // 当前是否为数据分析模式
    let chartInstance = null; // ECharts实例

    // --- 事件监听 ---
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });
    modeToggleButton.addEventListener('click', toggleAnalysisMode);

    // --- 函数定义 ---

    /**
     * 切换数据分析模式的开启和关闭状态。
     */
    function toggleAnalysisMode() {
        isAnalysisMode = !isAnalysisMode;
        if (isAnalysisMode) {
            modeToggleButton.textContent = '分析模式: 开';
            modeToggleButton.className = 'mode-on';
            appendMessage('系统', '数据分析模式已开启。现在发送的消息将尝试获取表格数据并进行分析。');
        } else {
            modeToggleButton.textContent = '分析模式: 关';
            modeToggleButton.className = 'mode-off';
            appendMessage('系统', '数据分析模式已关闭。');
        }
    }

    /**
     * 处理消息发送，根据当前模式路由到不同的处理器。
     */
    function sendMessage() {
        const messageText = userInput.value.trim();
        if (!messageText) return;

        appendMessage('我', messageText);
        userInput.value = '';

        if (isAnalysisMode) {
            startDataAnalysis(messageText);
        } else {
            // 普通聊天功能的占位符
            appendMessage('助手', '普通对话模式暂未实现。');
        }
    }

    /**
     * 向对话容器中追加一条消息。
     * @param {string} sender - 发送者: '我', '助手', or '系统'.
     * @param {string} text - 消息内容。
     */
    function appendMessage(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        if (sender === '我') {
            messageDiv.classList.add('user-message');
        } else if (sender === '助手') {
            messageDiv.classList.add('assistant-message');
        } else {
            messageDiv.classList.add('system-message');
        }
        messageDiv.textContent = text;
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight; // 自动滚动到底部
    }

    /**
     * 启动数据分析流程。
     * @param {string} userQuery - 用户的分析指令。
     */
    async function startDataAnalysis(userQuery) {
        // 1. 从WPS获取数据
        const data = getSelectedDataFromWPS();
        if (!data) {
            appendMessage('系统', '错误：无法获取WPS表格数据或未选中任何数据。');
            return;
        }

        // 2. 定义真实的LLM服务
        const llmService = {
            /**
             * 调用公司的内网LLM服务。
             * 注意: 请将此处的占位符逻辑替换为真实的API调用。
             */
            call: async (history, systemPrompt) => {
                // --- 开始: 请将这部分替换为您的真实API调用 ---
                console.log("正在调用LLM服务，参数:", { systemPrompt, history });
                appendMessage('系统', '正在调用内网LLM服务...');
                
                // 模拟网络延迟
                await new Promise(resolve => setTimeout(resolve, 1000));

                // 这是一个模拟的响应。在真实场景中，您应该使用 fetch()
                // 将 `history` 和 `systemPrompt` 发送到您的LLM端点，
                // 并返回响应的文本。
                const mockResponse = `
thought: 用户想要分析数据，我将使用Danfo.js计算每个类别的总和，并用ECharts生成一个柱状图来展示结果。
action: generate_chart_from_code
code: |
  // 按第一列分组，并计算第二列的总和
  const grouped = df.groupby([df.columns[0]]).col([df.columns[1]]).sum();
  
  const option = {
    title: {
      text: '数据分析图表'
    },
    tooltip: {},
    xAxis: {
      type: 'category',
      data: grouped[df.columns[0]].values
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      name: '总和',
      type: 'bar',
      data: grouped[df.columns[1]+'_sum'].values
    }]
  };
  return option;
final_report: "图表已生成。它显示了按类别分组的数据总和。"
`;
                return mockResponse;
                // --- 结束: 请替换这部分 ---
            }
        };
        
        // 3. 初始化并运行代理
        const agent = new DataAnalysisAgent(llmService, (progress) => {
            // 处理来自代理的进度更新的回调函数
            if (progress.type === 'system') {
                appendMessage('系统', progress.content);
            }
        });

        try {
            const result = await agent.analyze(userQuery, data);
            
            if (result.plotSpec) {
                renderChart(result.plotSpec);
            }
            if (result.report) {
                appendMessage('助手', result.report);
            }
        } catch (error) {
            appendMessage('系统', `分析失败: ${error.message}`);
            console.error(error);
        }
    }

    /**
     * 使用ECharts渲染图表。
     * @param {object} option - ECharts的option配置对象。
     */
    function renderChart(option) {
        chartContainer.style.display = 'block';
        if (!chartInstance) {
            chartInstance = echarts.init(chartContainer);
        }
        chartInstance.setOption(option);
    }

    /**
     * 从WPS当前活动工作表中获取选中的数据。
     * 成功则返回一个二维数组，失败则返回null。
     */
    function getSelectedDataFromWPS() {
        try {
            // 这是一个占位符。在真实的WPS环境中，您应该使用:
            // return wps.Application.ActiveSheet.Selection.Value();
            // 为了在WPS环境外测试，我们返回模拟数据。
            if (typeof wps === 'undefined' || typeof wps.Application === 'undefined') {
                console.warn("WPS环境未找到，返回模拟数据。");
                return [
                    ["类别", "数值"],
                    ["A", 10],
                    ["B", 25],
                    ["C", 15],
                    ["D", 30]
                ];
            }
            // 在真实环境中，应该执行这个调用
            return wps.Application.ActiveSheet.Selection.Value();
        } catch (error) {
            console.error("获取WPS数据失败:", error);
            return null;
        }
    }

});
