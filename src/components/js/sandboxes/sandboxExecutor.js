/**
 * sandboxExecutor.js
 *
 * 该模块作为与 Web Worker 沙箱交互的门面（Facade）。
 * 它处理 worker 的创建和生命周期管理，并提供一个简单的、
 * 基于 Promise 的接口来在沙箱中执行代码。
 */

let worker = null;
let executionPromise = null;

/**
 * 初始化沙箱 worker。
 * @returns {Promise<void>} 一个在 worker 准备就绪时解析的 Promise。
 */
const initializeSandbox = () => {
    return new Promise((resolve, reject) => {
        try {
            // 创建 worker。{ type: 'module' } 选项对于现代JS特性很重要。
            worker = new Worker(new URL('./webWorkerSandbox.js', import.meta.url), { type: 'module' });

            worker.onmessage = (event) => {
                if (event.data.type === 'ready') {
                    console.log('✅ 沙箱 worker 已准备就绪。');
                    resolve();
                } else if (executionPromise) {
                    // 处理执行结果
                    if (event.data.type === 'success') {
                        executionPromise.resolve(event.data.payload);
                    } else if (event.data.type === 'error') {
                        executionPromise.reject(event.data.payload);
                    }
                    executionPromise = null;
                }
            };

            worker.onerror = (error) => {
                console.error('❌ 沙箱 worker 出错:', error);
                if (executionPromise) {
                    executionPromise.reject({
                        source: 'worker-internal',
                        message: error.message
                    });
                    executionPromise = null;
                }
                reject(error);
            };
        } catch (error) {
            console.error('❌ 初始化沙箱 worker 失败:', error);
            reject(error);
        }
    });
};

/**
 * 在沙箱内执行JavaScript代码。
 * @param {string} code 要执行的代码。
 * @returns {Promise<object>} 一个解析为执行结果的 Promise。
 */
export const executeInSandbox = async (code) => {
    if (!worker) {
        await initializeSandbox();
    }

    return new Promise((resolve, reject) => {
        executionPromise = { resolve, reject };
        worker.postMessage({ code });
    });
};

/**
 * 终止沙箱 worker。
 */
export const terminateSandbox = () => {
    if (worker) {
        worker.terminate();
        worker = null;
        console.log('⏹️ 沙箱 worker 已终止。');
    }
};

// 模块加载后立即初始化沙箱。
initializeSandbox().catch(err => {
    console.error("初始沙箱设置失败:", err);
});
