//在后续的wps版本中，wps的所有枚举值都会通过wps.Enum对象来自动支持，现阶段先人工定义
var WPS_Enum = {
    msoCTPDockPositionLeft:0,
    msoCTPDockPositionRight:2
}

/**
 * 获取当前WPS表格中选定或已使用区域的数据。
 * @param {boolean} asRaw - 如果为 true，返回用于数据分析的原始JSON对象数组。如果为 false，返回用于聊天上下文的Markdown字符串。
 * @returns {Array<Object>|string|null} - 返回数据或null/空字符串。
 */
function getTableContextData(asRaw = false) {
    try {
        const app = wps.EtApplication();
        if (!app) {
            console.error("WPS Application object is not available.");
            return asRaw ? null : "";
        }
        const activeSheet = app.ActiveSheet;
        if (!activeSheet) {
            console.warn("No active sheet found.");
            return asRaw ? null : "";
        }

        let targetRange = null;
        const selection = app.Selection;
        const usedRange = activeSheet.UsedRange;

        let useUserSelection = false;

        if (selection && typeof selection.Address !== 'undefined' && selection.Parent && selection.Parent.Name === activeSheet.Name) {
            let selectionCellCount = 0;
            try {
                if (typeof selection.CountLarge !== 'undefined') {
                    selectionCellCount = selection.CountLarge;
                } else if (typeof selection.Count !== 'undefined') {
                    selectionCellCount = selection.Count;
                }
            } catch (e) {
                console.warn("获取 selection.Count 失败:", e);
            }
            
            if (selectionCellCount > 1) {
                useUserSelection = true;
            }
        }

        if (useUserSelection) {
            targetRange = selection;
        } else {
            if (usedRange && typeof usedRange.Address !== 'undefined') {
                let usedRangeCellCount = 0;
                try {
                    if (typeof usedRange.CountLarge !== 'undefined') {
                        usedRangeCellCount = usedRange.CountLarge;
                    } else if (typeof usedRange.Count !== 'undefined') {
                        usedRangeCellCount = usedRange.Count;
                    }
                } catch (e) {
                     console.warn("获取 usedRange.Count 失败:", e);
                }

                if (usedRangeCellCount > 0) {
                    targetRange = usedRange;
                }
            }
        }

        if (!targetRange) {
            console.warn("无法确定有效的数据区域。");
            return asRaw ? null : "";
        }

        let dataValues = [];
        try {
            const rowCount = targetRange.Rows.Count;
            const colCount = targetRange.Columns.Count;

            if (rowCount === 0 || colCount === 0) {
                return asRaw ? null : "";
            }

            for (let r = 1; r <= rowCount; r++) {
                const rowData = [];
                for (let c = 1; c <= colCount; c++) {
                    let cellText = '';
                    try {
                        const cell = targetRange.Item(r, c);
                        if (cell) {
                            cellText = (typeof cell.Text === 'function') ? cell.Text() : cell.Text;
                        }
                    } catch (cellError) {
                        cellText = "";
                    }
                    rowData.push(cellText === null || cellText === undefined ? "" : String(cellText));
                }
                dataValues.push(rowData);
            }
            
            if (dataValues.length === 0) {
                 return asRaw ? null : "";
            }

        } catch (e) {
            console.error("遍历读取区域数据失败:", e);
            return asRaw ? null : "";
        }

        if (asRaw) {
            if (dataValues.length < 1) return [];
            // For DataAnalysisAgent, convert to array of objects
            const headers = dataValues[0];
            const jsonData = dataValues.slice(1).map(row => {
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = row[index];
                });
                return obj;
            });
            return jsonData;
        } else {
            // For standard chat, return as Markdown
            return formatTableDataForAI(dataValues);
        }
    } catch (error) {
        console.error('获取表格上下文数据失败:', error);
        return asRaw ? null : "";
    }
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
        const rangeMatch = range.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
        if (!rangeMatch) {
            // 如果是单个单元格
            const singleCellMatch = range.match(/([A-Z]+)(\d+)/);
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

// 获取单元格的实际值
function getCellValue(cell) {
    try {
        if (!cell) return '';

        // 尝试多种方式获取单元格值
        let value = null;

        // 方法1: 直接获取Value属性
        if (typeof cell.Value === 'function') {
            try {
                value = cell.Value();
            } catch (e) {
                // 如果调用失败，尝试其他方法
            }
        } else {
            value = cell.Value;
        }

        // 方法2: 如果Value是函数或undefined，尝试Text属性
        if (value === null || value === undefined || typeof value === 'function') {
            if (typeof cell.Text === 'function') {
                try {
                    value = cell.Text();
                } catch (e) {
                    // 继续尝试其他方法
                }
            } else {
                value = cell.Text;
            }
        }

        // 方法3: 如果还是获取不到，尝试Value2属性
        if (value === null || value === undefined || typeof value === 'function') {
            if (typeof cell.Value2 === 'function') {
                try {
                    value = cell.Value2();
                } catch (e) {
                    // 继续尝试其他方法
                }
            } else {
                value = cell.Value2;
            }
        }

        // 方法4: 最后尝试Formula属性
        if (value === null || value === undefined || typeof value === 'function') {
            if (typeof cell.Formula === 'function') {
                try {
                    value = cell.Formula();
                } catch (e) {
                    value = '';
                }
            } else {
                value = cell.Formula || '';
            }
        }

        // 确保返回字符串或数字
        if (value === null || value === undefined || typeof value === 'function') {
            return '';
        }

        return value;
    } catch (error) {
        console.error('获取单元格值失败:', error);
        return '';
    }
}

// 将列字母转换为数字 (A=1, B=2, ...)
function columnLetterToNumber(letter) {
    let result = 0;
    for (let i = 0; i < letter.length; i++) {
        result = result * 26 + (letter.charCodeAt(i) - 64);
    }
    return result;
}

function setTableData(sheet, range, data) {
    try {
        if (!sheet) {
            sheet = window.Application.ActiveSheet;
        }

        if (!sheet) {
            throw new Error('无法获取工作表对象');
        }

        // 验证数据格式
        if (!data || !Array.isArray(data)) {
            throw new Error('数据必须是数组格式');
        }

        if (data.length === 0) {
            throw new Error('数据数组不能为空');
        }

        // 确保所有行都是数组
        for (let i = 0; i < data.length; i++) {
            if (!Array.isArray(data[i])) {
                throw new Error(`第${i + 1}行数据不是数组格式`);
            }
        }

        // 获取范围对象
        const rangeObj = sheet.Range(range);
        if (!rangeObj) {
            throw new Error(`无法创建范围对象: ${range}`);
        }

        // 尝试不同的写入方法
        try {
            // 方法1: 使用Value2属性（WPS推荐）
            rangeObj.Value2 = data;
            return true;
        } catch (value2Error) {
            try {
                // 方法2: 使用Value属性（备用）
                rangeObj.Value = data;
                return true;
            } catch (valueError) {
                try {
                    // 方法3: 逐行写入
                    return setTableDataRowByRow(sheet, range, data);
                } catch (rowError) {
                    // 方法4: 逐个单元格写入
                    return setTableDataCellByCell(sheet, range, data);
                }
            }
        }

    } catch (error) {
        console.error('设置表格数据失败:', error);
        return false;
    }
}

// 逐行写入数据
function setTableDataRowByRow(sheet, range, data) {
    // 解析范围
    const rangeMatch = range.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
    if (!rangeMatch) {
        throw new Error(`无效的范围格式: ${range}`);
    }

    const startCol = columnLetterToNumber(rangeMatch[1]);
    const startRow = parseInt(rangeMatch[2]);
    const endCol = columnLetterToNumber(rangeMatch[3]);
    const endRow = parseInt(rangeMatch[4]);

    // 逐行写入
    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
        const row = data[rowIndex];
        const currentRow = startRow + rowIndex;

        if (currentRow > endRow) {
            break;
        }

        // 构建当前行的范围
        const rowRange = `${rangeMatch[1]}${currentRow}:${rangeMatch[3]}${currentRow}`;

        try {
            const rowRangeObj = sheet.Range(rowRange);
            // 优先使用Value2属性
            try {
                rowRangeObj.Value2 = [row]; // 包装成二维数组
            } catch (value2Error) {
                rowRangeObj.Value = [row]; // 备用方案
            }
        } catch (rowError) {
            throw rowError;
        }
    }

    return true;
}

// 逐个单元格写入数据
function setTableDataCellByCell(sheet, range, data) {
    // 解析范围
    const rangeMatch = range.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
    if (!rangeMatch) {
        throw new Error(`无效的范围格式: ${range}`);
    }

    const startCol = columnLetterToNumber(rangeMatch[1]);
    const startRow = parseInt(rangeMatch[2]);

    // 逐个单元格写入
    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
        const row = data[rowIndex];

        for (let colIndex = 0; colIndex < row.length; colIndex++) {
            const cellRow = startRow + rowIndex;
            const cellCol = startCol + colIndex;
            const cellValue = row[colIndex];

            try {
                const cell = sheet.Cells.Item(cellRow, cellCol);
                // 优先使用Value2属性
                try {
                    cell.Value2 = cellValue;
                } catch (value2Error) {
                    cell.Value = cellValue; // 备用方案
                }
            } catch (cellError) {
                throw cellError;
            }
        }
    }

    return true;
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

    return markdownTable;
}

function GetUrlPath() {
    // 在本地网页的情况下获取路径
    if (window.location.protocol === 'file:') {
      const path = window.location.href;
      // 删除文件名以获取根路径
      return path.substring(0, path.lastIndexOf('/'));
    }

    // 在非本地网页的情况下获取根路径
    const { protocol, hostname, port } = window.location;
    const portPart = port ? `:${port}` : '';
    return `${protocol}//${hostname}${portPart}`;
  }

  function GetRouterHash() {
    if (window.location.protocol === 'file:') {
      return '';
    }

    return '/#'
  }

export default{
    WPS_Enum,
    GetUrlPath,
    GetRouterHash,
    getTableData,
    setTableData,
    getTableContextData,
    getCellValue,
    columnLetterToNumber,
}
