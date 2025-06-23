/**
 * resultParser.js
 *
 * 该模块负责解析从沙箱执行器收到的结果。
 * 它将输出标准化，提取关键信息（如Plotly配置或文本答案），
 * 并格式化错误以便用户友好地显示。
 */

/**
 * 解析沙箱返回的成功执行结果。
 * @param {object} sandboxResult - 沙箱返回的结果对象。
 * @returns {object} - 标准化的、供AI聊天面板使用的结果对象。
 */
function parseSuccess(sandboxResult) {
    const { result, logs } = sandboxResult;

    if (result && typeof result === 'object' && result.plotlyConfig) {
        // 这是一个 Plotly 图表结果
        return {
            success: true,
            type: 'plotly_chart',
            plotlyConfig: result.plotlyConfig,
            content: "📊 图表已生成。",
            logs: logs
        };
    } else {
        // 这是一个文本或数据结果
        let content;
        if (typeof result === 'string') {
            content = result;
        } else if (result !== undefined && result !== null) {
            // 对于非字符串结果，美化输出JSON
            content = '```json\n' + JSON.stringify(result, null, 2) + '\n```';
        } else {
            content = "✅ 代码成功执行，但没有返回值。";
        }

        return {
            success: true,
            type: 'text_result',
            content: content,
            logs: logs
        };
    }
}

/**
 * 解析沙箱返回的错误结果。
 * @param {object} sandboxError - 沙箱返回的错误对象。
 * @returns {object} - 标准化的错误结果对象。
 */
function parseError(sandboxError) {
    const { message, stack, logs, source } = sandboxError;
    
    let errorMessage = `代码执行期间发生错误。\n\n**来源:** ${source}\n**信息:** ${message}`;
    
    if (logs && logs.length > 0) {
        errorMessage += `\n\n**日志:**\n\`\`\`\n${logs.join('\n')}\n\`\`\``;
    }

    if (stack) {
        errorMessage += `\n\n**堆栈跟踪:**\n\`\`\`\n${stack}\n\`\`\``;
    }

    return {
        success: false,
        type: 'error',
        content: `❌ ${errorMessage}`
    };
}

/**
 * 解析沙箱执行器的原始输出。
 * @param {object} rawResult - 来自 executeInSandbox 的原始结果对象。
 * @param {boolean} isSuccess - 指示执行是否成功的标志。
 * @returns {object} - 标准化的结果对象。
 */
export function parseSandboxResult(rawResult, isSuccess) {
    if (isSuccess) {
        return parseSuccess(rawResult);
    } else {
        return parseError(rawResult);
    }
}
