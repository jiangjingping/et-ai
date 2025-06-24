import asyncio
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
from data_analysis_agent import DataAnalysisAgent
import pandas as pd
import io

# --- FastAPI 应用实例 ---
app = FastAPI(
    title="WPS-AI Data Analysis Backend",
    description="一个基于FastAPI的后端服务，用于驱动数据分析智能体。",
    version="1.0.0",
)

# --- CORS 中间件配置 ---
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 静态文件服务 ---
# 将 'outputs' 目录挂载到 '/outputs' URL 路径下
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

# --- 数据模型 ---
class AnalysisRequest(BaseModel):
    user_input: str
    csv_data: str

# --- Agent 实例 ---
agent = DataAnalysisAgent()

# --- API 端点 ---
@app.post("/analyze")
async def analyze_data(request: AnalysisRequest):
    """
    接收数据分析请求，并以流式响应返回分析过程。
    """
    try:
        temp_csv_path = "temp_data.csv"
        if request.csv_data:
            csv_file = io.StringIO(request.csv_data)
            df = pd.read_csv(csv_file)
            df.to_csv(temp_csv_path, index=False)
        
        queue = asyncio.Queue()

        # 在后台任务中运行Agent的分析过程
        asyncio.create_task(
            agent.analyze_stream(
                user_input=request.user_input, 
                files=[temp_csv_path] if request.csv_data else [], 
                queue=queue
            )
        )

        async def event_generator():
            """
            从队列中读取日志并将其作为SSE事件流发送。
            """
            while True:
                # 从队列中获取下一个日志块
                log_chunk = await queue.get()
                
                # 如果是结束信号 (None)，则停止生成
                if log_chunk is None:
                    break
                
                # 格式化为 Server-Sent Events (SSE)，并确保中文正常显示
                yield f"data: {json.dumps(log_chunk, ensure_ascii=False)}\n\n"
        
        return StreamingResponse(event_generator(), media_type="text/event-stream")

    except Exception as e:
        # 确保即使在设置阶段出错，也能返回一个有意义的HTTP错误
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

# --- 启动服务 ---
if __name__ == "__main__":
    uvicorn.run("backend_service:app", host="127.0.0.1", port=8000, reload=True)
