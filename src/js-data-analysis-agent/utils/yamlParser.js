import yaml from 'js-yaml';

/**
 * @file yamlParser.js
 * @description 一个使用 js-yaml 库从 LLM 响应中解析 YAML 字符串的工具。
 */

/**
 * 从字符串中提取并解析 YAML 块。
 * @param {string} text 包含 YAML 块的文本。
 * @returns {object|null} 解析后的 JavaScript 对象，如果解析失败则返回 null。
 */
export function parseYaml(text) {
    try {
        // 查找 YAML 块，它可能被 ```yaml ... ``` 包围
        const match = text.match(/```yaml\n([\s\S]*?)\n```/);
        
        let yamlString;
        if (match && match[1]) {
            // 如果找到了围栏代码块，则使用其内容
            yamlString = match[1];
        } else {
            // 否则，假定整个字符串都是 YAML
            yamlString = text;
        }

        // 使用 js-yaml 安全地加载 YAML 字符串
        const data = yaml.load(yamlString);
        
        // 确保结果是一个对象
        if (typeof data === 'object' && data !== null) {
            return data;
        } else {
            console.warn("解析出的 YAML 不是一个对象:", data);
            return null;
        }

    } catch (error) {
        console.error("解析 YAML 失败:", error);
        return null;
    }
}
