/**
 * @file worker.js
 * @description 该脚本在 Web Worker 中运行。它是一个安全的沙箱，
 * 用于执行由 LLM 生成的数据分析代码。
 * 它通过 postMessage 与主线程通信。
 */

/**
 * @file worker.js
 * @description 该脚本在 Web Worker 中运行。它是一个安全的沙箱，
 * 用于执行由 LLM 使用 Danfo.js 生成的数据处理代码。
 * 它不处理绘图。
 */

import * as df from 'danfojs';

self.onmessage = async function(event) {
    const { code, data } = event.data;
    console.log("WORKER: 收到消息。", { code });

    try {
        // 我们将导入的 'danfojs' 库 (作为 'df') 传递到沙箱函数中。
        // 该函数期望一个名为 'danfo' 的参数，因此我们将 'df' 传递给它。
        // 这确保了由 LLM 生成的、使用 'danfo' 的代码能够正确工作。
        const func = new Function('danfo', 'data', `return (async () => { ${code} })();`);
        
        // 执行函数，将导入的 'df' 模块作为 'danfo' 参数传递。
        const executionResult = await func(df, data);

        const result = {
            success: true,
            data: executionResult,
            error: null
        };
        
        console.log("WORKER: 代码执行成功。正在将结果发送到主线程。", result);
        self.postMessage(result);

    } catch (error) {
        console.error("WORKER: 执行代码时出错。", error);
        self.postMessage({
            success: false,
            data: null,
            error: error.message
        });
    }
};
