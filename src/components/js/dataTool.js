import * as dfd from 'danfojs';

/**
 * 动态执行 Danfo.js 代码
 * @param {string} code - 要执行的 Danfo.js 代码字符串
 * @param {Array<Array<any>>} data - 从表格读取的原始数据
 * @returns {Promise<any>} - 返回执行结果
 */
async function executeDanfoCode(code, data) {
    try {
        // 创建一个 DataFrame，并指定列名
        const headers = data[0];
        const body = data.slice(1);
        let df = new dfd.DataFrame(body, { columns: headers });

        // 数据清洗与类型预处理
        for (const col of df.columns) {
            const columnData = df[col];
            // 检查列中是否所有非空值都是数字或数字字符串
            const isNumeric = columnData.values.every(val => {
                return val === null || val === '' || !isNaN(Number(val));
            });

            if (isNumeric) {
                // 对于数值列，先用0填充空值，然后转换类型
                const filled = columnData.fillNa(0);
                df.addColumn(col, filled, { inplace: true });
                df = df.asType(col, 'float32');
                console.log(`列 "${col}" 已成功填充空值并转换为 float32 类型。`);
            } else {
                // 对于非数值列（如'班级'），用 'N/A' 填充空值
                const filled = columnData.fillNa('N/A');
                df.addColumn(col, filled, { inplace: true });
                console.log(`列 "${col}" 已成功填充空值。`);
            }
        }
        
        // 使用 Function 构造函数来创建一个可以在特定上下文中执行的函数
        // 我们将 df, dfd, 和原始的 data 注入到这个函数的作用域中
        const danfoFunction = new Function('df', 'dfd', 'data', code);

        // 执行代码
        const result = await danfoFunction(df, dfd, data);

        // 如果结果是一个 DataFrame，将其转换为 JSON 格式以便后续处理
        if (result instanceof dfd.DataFrame || result instanceof dfd.Series) {
            return dfd.toJSON(result, { format: 'row' });
        }

        return result;
    } catch (error) {
        console.error('Error executing Danfo.js code:', error);
        throw new Error(`Danfo.js code execution failed: ${error.message}`);
    }
}

export { executeDanfoCode };
