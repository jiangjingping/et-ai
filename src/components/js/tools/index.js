/**
 * 工具模块入口文件
 * 导出所有工具类并提供初始化功能
 */

import { toolRegistry } from '../agents/toolRegistry.js';
import { GeneralQATool } from './generalQATool.js';
import { TableQATool } from './tableQATool.js';
import { SimpleChartTool } from './simpleChartTool.js';
import { AdvancedAnalyticsTool } from './advancedAnalyticsTool.js';

/**
 * 初始化所有工具
 * @returns {Promise<void>}
 */
export async function initializeTools() {
    try {
        console.log('Initializing analysis tools...');
        
        // 创建工具实例
        const generalQA = new GeneralQATool();
        const tableQA = new TableQATool();
        const simpleChart = new SimpleChartTool();
        const advancedAnalytics = new AdvancedAnalyticsTool();
        
        // 初始化工具
        await generalQA.initialize();
        await tableQA.initialize();
        await simpleChart.initialize();
        await advancedAnalytics.initialize();
        
        // 注册工具到注册表
        toolRegistry.register('general_qa', generalQA);
        toolRegistry.register('table_qa', tableQA);
        toolRegistry.register('simple_chart', simpleChart);
        toolRegistry.register('advanced_analytics', advancedAnalytics);
        
        // 初始化注册表
        await toolRegistry.initialize();
        
        console.log('All tools initialized successfully');
        console.log('Available tools:', toolRegistry.getToolNames());
        
    } catch (error) {
        console.error('Failed to initialize tools:', error);
        throw error;
    }
}

/**
 * 获取工具统计信息
 * @returns {Object} 工具统计
 */
export function getToolsStats() {
    return toolRegistry.getStats();
}

/**
 * 获取所有工具的描述信息
 * @returns {Array<Object>} 工具描述列表
 */
export function getToolsDescriptions() {
    return toolRegistry.getToolDescriptions();
}

// 导出工具类
export {
    GeneralQATool,
    TableQATool,
    SimpleChartTool,
    AdvancedAnalyticsTool
};

// 导出工具注册表
export { toolRegistry };
