//在后续的wps版本中，wps的所有枚举值都会通过wps.Enum对象来自动支持，现阶段先人工定义
var WPS_Enum = {
    msoCTPDockPositionLeft:0,
    msoCTPDockPositionRight:2
}

// AI功能相关的工具函数
function getTableData(sheet, range) {
    try {
        if (!sheet) {
            sheet = window.Application.ActiveSheet;
        }

        if (!range) {
            // 获取已使用的区域
            const usedRange = sheet.UsedRange;
            if (!usedRange) return null;

            const rowCount = usedRange.Rows.Count;
            const colCount = usedRange.Columns.Count;

            // 如果只有一个单元格，直接获取值
            if (rowCount === 1 && colCount === 1) {
                const cellValue = getCellValue(sheet.Cells.Item(1, 1));
                return [[cellValue]];
            }

            // 构建范围字符串
            const endCol = String.fromCharCode(64 + colCount);
            range = `A1:${endCol}${rowCount}`;
        }

        // 解析范围并逐个获取单元格值
        console.log("Parsing range address:", range);
        // Regex to handle optional '$' signs, e.g., $A$1:$L$91
        const rangeMatch = range.match(/\$?([A-Z]+)\$?(\d+):\S?([A-Z]+)\$?(\d+)/);
        if (!rangeMatch) {
            // 如果是单个单元格
            const singleCellMatch = range.match(/\$?([A-Z]+)\$?(\d+)/);
            if (singleCellMatch) {
                const col = columnLetterToNumber(singleCellMatch[1]);
                const row = parseInt(singleCellMatch[2]);
                const cellValue = getCellValue(sheet.Cells.Item(row, col));
                return [[cellValue]];
            }
            return null;
        }

        const startCol = columnLetterToNumber(rangeMatch[1]);
        const startRow = parseInt(rangeMatch[2]);
        const endCol = columnLetterToNumber(rangeMatch[3]);
        const endRow = parseInt(rangeMatch[4]);

        const result = [];
        for (let row = startRow; row <= endRow; row++) {
            const rowData = [];
            for (let col = startCol; col <= endCol; col++) {
                const cellValue = getCellValue(sheet.Cells.Item(row, col));
                rowData.push(cellValue);
            }
            result.push(rowData);
        }

        return result;
    } catch (error) {
        console.error('获取表格数据失败:', error);
        return null;
    }
}

function formatTableDataForAI(data) {
    if (!data || !Array.isArray(data) || data.length === 0) {
        return '';
    }

    // 确保所有行都是数组
    const cleanData = data.map(row => Array.isArray(row) ? row : [row]);

    const header = cleanData[0].map(cell => String(cell === null || cell === undefined ? '' : cell).replace(/\|/g, '\\|'));
    const separator = header.map(() => '---');

    const body = cleanData.slice(1).map(row =>
        row.map(cell => String(cell === null || cell === undefined ? '' : cell).replace(/\|/g, '\\|'))
    );

    let markdownTable = '';
    markdownTable += `| ${header.join(' | ')} |\n`;
    markdownTable += `| ${separator.join(' | ')} |\n`;

    body.forEach(row => {
        // 确保每行都有与表头相同数量的列，不足则补空字符串
        const fullRow = [];
        for (let i = 0; i < header.length; i++) {
            fullRow.push(row[i] !== undefined ? row[i] : '');
        }
        markdownTable += `| ${fullRow.join(' | ')} |\n`;
    });

    // 如果原始数据只有一行，那么 body 为空，只输出表头和分隔符
    // 如果原始数据为空数组（已被上面逻辑处理），这里不会执行

    return markdownTable;
}

function getTableContextDataAsJson() {
    try {
        const app = window.wps.EtApplication();
        if (!app) {
            console.error("WPS Application object is not available.");
            return null;
        }
        const activeSheet = app.ActiveSheet;
        if (!activeSheet) {
            console.warn("No active sheet found.");
            return null;
        }

        const usedRange = activeSheet.UsedRange;
        if (!usedRange) {
            console.warn("UsedRange is not available.");
            return null;
        }

        const address = typeof usedRange.Address === 'function' ? usedRange.Address() : usedRange.Address;
        const data = getTableData(activeSheet, address);
        if (!data || data.length < 1) {
            // Requires at least a header row.
            console.warn("getTableContextDataAsJson: Not enough data, requires at least a header row.");
            return null;
        }

        const headers = data[0];
        const jsonData = [];

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const rowObject = {};
            for (let j = 0; j < headers.length; j++) {
                rowObject[headers[j]] = row[j];
            }
            jsonData.push(rowObject);
        }

        return jsonData;

    } catch (error) {
        console.error('获取表格上下文JSON数据失败:', error);
        return null;
    }
}

// 获取上下文表格数据并格式化为Markdown
function getTableContextDataAsMarkdown() {
    try {
        const app = window.wps.EtApplication();
        if (!app) {
            console.error("WPS Application object is not available.");
            return "";
        }
        const activeSheet = app.ActiveSheet;
        if (!activeSheet) {
            console.warn("No active sheet found.");
            return "";
        }

        let targetRange = null;
        const selection = app.Selection;
        const usedRange = activeSheet.UsedRange;

        let useUserSelection = false;

        if (selection && typeof selection.Address !== 'undefined' && selection.Parent && selection.Parent.Name === activeSheet.Name) {
            // Selection 有效且在当前活动工作表
            // 检查选中单元格的数量
            // WPS JSAPI 中，Range 对象直接有 Count 或 CountLarge 属性，或者通过其 Cells 集合的 Count/CountLarge
            let selectionCellCount = 0;
            try {
                // 优先尝试直接获取 Range 的单元格数量
                if (typeof selection.CountLarge !== 'undefined') {
                    selectionCellCount = selection.CountLarge;
                } else if (typeof selection.Count !== 'undefined') {
                    selectionCellCount = selection.Count;
                } else if (selection.Cells && typeof selection.Cells.CountLarge !== 'undefined') {
                    selectionCellCount = selection.Cells.CountLarge;
                } else if (selection.Cells && typeof selection.Cells.Count !== 'undefined') {
                    selectionCellCount = selection.Cells.Count;
                }
            } catch (e) {
                console.warn("获取 selection.Cells.Count 失败:", e);
            }
            
            if (selectionCellCount > 1) {
                useUserSelection = true;
            }
        }

        if (useUserSelection) {
            targetRange = selection;
        } else {
            // 如果用户选择的单元格数不大于1，或者选择无效，则使用 UsedRange
            if (usedRange && typeof usedRange.Address !== 'undefined') {
                 // 确保 UsedRange 至少有一个单元格，避免空表或完全清除的表格导致 UsedRange.Cells.Count 为0或异常
                let usedRangeCellCount = 0;
                try {
                    if (typeof usedRange.CountLarge !== 'undefined') {
                        usedRangeCellCount = usedRange.CountLarge;
                    } else if (typeof usedRange.Count !== 'undefined') {
                        usedRangeCellCount = usedRange.Count;
                    } else if (usedRange.Cells && typeof usedRange.Cells.CountLarge !== 'undefined') {
                        usedRangeCellCount = usedRange.Cells.CountLarge;
                    } else if (usedRange.Cells && typeof usedRange.Cells.Count !== 'undefined') {
                        usedRangeCellCount = usedRange.Cells.Count;
                    }
                } catch (e) {
                     console.warn("获取 usedRange.Cells.Count 失败:", e);
                }

                if (usedRangeCellCount > 0) {
                    targetRange = usedRange;
                }
            }
        }

        if (!targetRange) {
            console.warn("无法确定有效的数据区域。");
            return "";
        }

        let dataValues = []; // 初始化为空数组
        try {
            const rowCount = targetRange.Rows.Count;
            const colCount = targetRange.Columns.Count;

            if (rowCount === 0 || colCount === 0) {
                console.warn("目标区域的行数或列数为0。");
                return ""; // 如果区域无效或为空，则返回空字符串
            }

            for (let r = 1; r <= rowCount; r++) {
                const rowData = [];
                for (let c = 1; c <= colCount; c++) {
                    let cellText = '';
                    try {
                        // targetRange.Item(r, c) 返回的是相对于 targetRange 左上角的单元格对象
                        const cell = targetRange.Item(r, c);
                        if (cell) {
                            // 优先尝试 Text 属性，它通常能更好地处理合并单元格的显示值
                            if (typeof cell.Text !== 'undefined') {
                                cellText = (typeof cell.Text === 'function') ? cell.Text() : cell.Text;
                            } else if (typeof cell.Value2 !== 'undefined') { // 备选 Value2
                                let cellVal = (typeof cell.Value2 === 'function') ? cell.Value2() : cell.Value2;
                                cellText = (cellVal === null || cellVal === undefined) ? "" : String(cellVal);
                            } else if (typeof cell.Value !== 'undefined') { // 备选 Value
                                let cellVal = (typeof cell.Value === 'function') ? cell.Value() : cell.Value;
                                cellText = (cellVal === null || cellVal === undefined) ? "" : String(cellVal);
                            }
                        }
                    } catch (cellError) {
                        console.warn(`读取单元格 (行:${r}, 列:${c} 相对于区域左上角) 文本失败:`, cellError);
                        cellText = ""; // 出错时默认为空字符串
                    }
                    rowData.push(cellText === null || cellText === undefined ? "" : String(cellText));
                }
                dataValues.push(rowData);
            }
            
            if (dataValues.length === 0) { // 如果遍历后仍然是空数组
                 console.warn("遍历读取后 dataValues 为空。");
                 return "";
            }

        } catch (e) {
            console.error("遍历读取区域数据失败:", e);
            return ""; // 读取失败
        }

        if (dataValues === null || typeof dataValues === 'undefined' || dataValues.length === 0) {
            // 区域为空或读取的值是 null/undefined
            return "";
        }
        
        let formattedDataValues;
        if (!Array.isArray(dataValues)) {
            // 单个单元格的情况
            formattedDataValues = [[dataValues]];
        } else if (dataValues.length > 0 && !Array.isArray(dataValues[0])) {
            // Range.Value() 返回一维数组 (例如单行或单列选择)
            if (targetRange.Rows.Count === 1 && targetRange.Columns.Count > 0) { // 单行
                formattedDataValues = [dataValues];
            } else if (targetRange.Columns.Count === 1 && targetRange.Rows.Count > 0) { // 单列
                formattedDataValues = dataValues.map(cell => [cell]);
            } else { // 无法确定具体是单行还是单列，或者就是单个值被包装成了一维数组
                 formattedDataValues = [dataValues]; // 默认按单行处理
            }
        } else if (dataValues.length === 0) {
            // 空数组
            return "";
        }
         else {
            // 本身就是二维数组
            formattedDataValues = dataValues;
        }
        console.log("formattedDataValues:")
        console.log(formattedDataValues)
        return formatTableDataForAI(formattedDataValues);
    } catch (error) {
        console.error('获取表格上下文数据失败:', error);
        return "";
    }
}


function extractHeadersFromMarkdown(markdownTable) {
    if (!markdownTable || typeof markdownTable !== 'string') return null;
    const lines = markdownTable.split('\n');
    if (lines.length < 1) return null; 
    
    const headerLine = lines[0].trim();
    if (!headerLine.startsWith('|') || !headerLine.endsWith('|')) return null;

    const headers = headerLine.slice(1, -1).split('|').map(h => h.trim()).filter(h => h);
    return headers.length > 0 ? headers : null;
}

export default{
    WPS_Enum,
    getTableData,
    setTableData,
    formatTableDataForAI, // 已修改为Markdown格式
    getTableContextDataAsMarkdown,
    getTableContextDataAsJson, // 新增函数
    extractHeadersFromMarkdown
}
