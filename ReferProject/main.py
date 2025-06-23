import asyncio
from data_analysis_agent import DataAnalysisAgent
from config.llm_config import LLMConfig

async def main():
    llm_config = LLMConfig()
    agent = DataAnalysisAgent(llm_config)
    #files = ["./贵州茅台利润表.csv"]
    #report = await agent.analyze(user_input="基于贵州茅台的数据，输出五个重要的统计指标，并绘制相关图表。最后生成汇报给我。",files=files)
    files = ["./学生成绩表.csv"]
    report = await agent.analyze(user_input="请进行数据分析，并绘制相关图表。最后生成汇报给我。",files=files)
    print(report)
    
if __name__ == "__main__":
    asyncio.run(main())
