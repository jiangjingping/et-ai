/**
 * webWorkerSandbox.js
 *
 * 该脚本在 Web Worker 中运行，提供一个沙箱环境
 * 用于执行不受信任的JavaScript代码，特别是使用 Danfo.js 和 Plotly.js 进行数据分析。
 *
 * 它监听包含待执行代码的消息，运行代码，捕获日志、错误和结果，
 * 并将它们发送回主线程。
 */

// 加载外部库。在 Web Worker 中，使用 importScripts 是标准方法。
// 我们使用 jsDelivr CDN 以确保库的稳定访问。
try {
    self.importScripts('https://cdn.jsdelivr.net/npm/danfojs@1.2.0/lib/bundle.min.js');
    self.importScripts('https://cdn.jsdelivr.net/npm/plotly.js-dist@3.0.1/plotly.min.js');
} catch (e) {
    // 如果脚本加载失败，向主线程发送错误消息。
    self.postMessage({
        type: 'error',
        payload: {
            source: 'sandbox-setup',
            message: `加载所需库失败: ${e.message}`
        }
    });
    // 如果设置失败，则关闭 worker。
    self.close();
}


// 重写 console.log 以捕获日志
const logs = [];
const originalLog = self.console.log;
self.console.log = (...args) => {
    logs.push(args.map(arg => JSON.stringify(arg, null, 2)).join(' '));
    originalLog.apply(self.console, args);
};

self.onmessage = async (event) => {
    const { code } = event.data;
    logs.length = 0; // 为每次新的执行清空日志

    try {
        // 使用异步函数构造器，以允许在执行的代码中使用 'await'
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const func = new AsyncFunction('df', 'Plotly', code);

        // 执行函数
        const result = await func(self.df, self.Plotly);

        // 将成功结果发送回主线程
        self.postMessage({
            type: 'success',
            payload: {
                result: result,
                logs: logs
            }
        });
    } catch (error) {
        // 将错误结果发送回主线程
        self.postMessage({
            type: 'error',
            payload: {
                source: 'execution',
                message: error.message,
                stack: error.stack,
                logs: logs
            }
        });
    }
};

// worker 设置完成后，向主线程发送一个 'ready' 消息。
self.postMessage({ type: 'ready' });
