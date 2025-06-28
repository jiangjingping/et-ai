import hljs from 'highlight.js';

// 简化的Markdown渲染器，不依赖外部库
// 如果需要更复杂的功能，可以后续集成marked库

// 简单的Markdown解析函数
function parseMarkdown(content) {
    if (!content || typeof content !== 'string') {
        return ''
    }

    let html = content

    // 处理代码块 (```) - 改进以更好地支持流式渲染
    html = html.replace(/```(\w+)?\n([\s\S]*?)(```|$)/g, (match, language, code, endMarker) => {
        // 如果代码块没有正确结束，我们只进行简单的HTML转义，以保证流式效果
        if (endMarker !== '```') {
            return `
                <div class="code-block">
                    <div class="code-header">
                        <span class="code-language">${language || 'plaintext'}</span>
                    </div>
                    <pre class="code-content"><code class="hljs language-${language || 'plaintext'}">${escapeHtml(code)}</code></pre>
                </div>
            `;
        }

        // 如果代码块已闭合，则进行语法高亮
        const lang = language || 'plaintext';
        const highlightedCode = hljs.getLanguage(lang) 
            ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
            : hljs.highlightAuto(code).value;

        return `
            <div class="code-block">
                <div class="code-header">
                    <span class="code-language">${lang}</span>
                </div>
                <pre class="code-content"><code class="hljs language-${lang}">${highlightedCode}</code></pre>
            </div>
        `
    })

    // 处理行内代码 (`)
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

    // 处理标题
    html = html.replace(/^### (.*$)/gm, '<h3 class="heading-3">$1</h3>')
    html = html.replace(/^#### (.*$)/gm, '<h4 class="heading-4">$1</h4>')
    html = html.replace(/^##### (.*$)/gm, '<h5 class="heading-5">$1</h5>')
    html = html.replace(/^###### (.*$)/gm, '<h6 class="heading-6">$1</h6>')
    html = html.replace(/^## (.*$)/gm, '<h2 class="heading-2">$1</h2>')
    html = html.replace(/^# (.*$)/gm, '<h1 class="heading-1">$1</h1>')

    // 处理粗体
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="strong-text">$1</strong>')

    // 处理斜体
    html = html.replace(/\*(.*?)\*/g, '<em class="italic-text">$1</em>')

    // 处理删除线
    html = html.replace(/~~(.*?)~~/g, '<del class="strikethrough-text">$1</del>')

    // 处理引用块
    html = html.replace(/^> (.*$)/gm, '<blockquote class="blockquote">$1</blockquote>')

    // 处理无序列表
    html = html.replace(/^- (.*$)/gm, '<li class="list-item">$1</li>')
    html = html.replace(/(<li class="list-item">.*<\/li>)/s, '<ul class="unordered-list">$1</ul>')

    // 处理有序列表
    html = html.replace(/^\d+\. (.*$)/gm, '<li class="list-item">$1</li>')

    // 处理任务列表
    html = html.replace(/^- \[x\] (.*$)/gm, '<li class="task-list-item"><input type="checkbox" checked disabled><span class="task-content">$1</span></li>')
    html = html.replace(/^- \[ \] (.*$)/gm, '<li class="task-list-item"><input type="checkbox" disabled><span class="task-content">$1</span></li>')

    // 处理链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="markdown-link" target="_blank" rel="noopener noreferrer">$1</a>')

    // 处理水平线
    html = html.replace(/^---$/gm, '<hr class="horizontal-rule">')

    // 处理表格
    html = processMarkdownTable(html)

    // 处理段落
    html = html.replace(/\n\n/g, '</p><p class="paragraph">')
    html = '<p class="paragraph">' + html + '</p>'

    // 清理空段落
    html = html.replace(/<p class="paragraph"><\/p>/g, '')

    // 处理换行
    html = html.replace(/\n/g, '<br>')

    return html
}

// HTML转义函数
function escapeHtml(text) {
    const map = {
        '&': '&',
        '<': '<',
        '>': '>',
        '"': '"',
        "'": '&#039;'
    }
    return text.replace(/[&<>"']/g, function(m) { return map[m] })
}

// 处理Markdown表格
function processMarkdownTable(html) {
    // 匹配Markdown表格格式
    const tableRegex = /(\|.*\|[\r\n]+\|[-\s|:]+\|[\r\n]+((\|.*\|[\r\n]*)+))/g

    return html.replace(tableRegex, (match) => {
        const lines = match.trim().split('\n')
        if (lines.length < 3) return match

        const headerLine = lines[0]
        const separatorLine = lines[1]
        const dataLines = lines.slice(2)

        // 解析表头
        const headers = headerLine.split('|').map(h => h.trim()).filter(h => h)

        // 解析数据行
        const rows = dataLines.map(line =>
            line.split('|').map(cell => cell.trim()).filter(cell => cell !== '')
        ).filter(row => row.length > 0)

        // 生成HTML表格
        let tableHtml = '<div class="table-container"><table class="markdown-table">'

        // 表头
        tableHtml += '<thead><tr>'
        headers.forEach(header => {
            tableHtml += `<th class="table-header">${header}</th>`
        })
        tableHtml += '</tr></thead>'

        // 表体
        tableHtml += '<tbody>'
        rows.forEach(row => {
            tableHtml += '<tr class="table-row">'
            row.forEach(cell => {
                tableHtml += `<td class="table-cell">${cell}</td>`
            })
            tableHtml += '</tr>'
        })
        tableHtml += '</tbody></table></div>'

        return tableHtml
    })
}

// 主要的Markdown渲染函数
export function renderMarkdown(content) {
    if (!content || typeof content !== 'string') {
        return ''
    }

    try {
        // 使用简化的Markdown解析
        return parseMarkdown(content)
    } catch (error) {
        console.error('Markdown渲染失败:', error)
        // 回退到简单的HTML转义
        return escapeHtml(content).replace(/\n/g, '<br>')
    }
}

// 导出渲染函数
export default {
    renderMarkdown,
    escapeHtml
}
