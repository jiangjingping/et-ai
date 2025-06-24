# -*- coding: utf-8 -*-
import os
import json
import asyncio
from typing import Dict, Any, List

from utils.create_session_dir import create_session_output_dir
from utils.format_execution_result import format_execution_result
from utils.extract_code import extract_code_from_response
from utils.llm_helper import LLMHelper
from utils.code_executor import CodeExecutor
from config.llm_config import LLMConfig
from prompts import data_analysis_system_prompt

class DataAnalysisAgent:
    def __init__(self, llm_config: LLMConfig = None, output_dir: str = "outputs", max_rounds: int = 10):
        self.config = llm_config or LLMConfig()
        self.llm = LLMHelper(self.config)
        self.base_output_dir = output_dir
        self.max_rounds = max_rounds
        self.reset()

    def _process_response(self, response: str) -> Dict[str, Any]:
        print("\n--- Processing LLM Response ---")
        try:
            yaml_data = self.llm.parse_yaml_response(response)
            action = yaml_data.get('action', 'generate_code')
            print(f"Action: {action}")

            if action == 'analysis_complete':
                print("Analysis complete action detected.")
                final_report_content = yaml_data.get('final_report', '')
                final_report = {
                    "text": final_report_content,
                    "images": self.generated_images
                }
                return {'action': 'analysis_complete', 'continue': False, 'final_report': final_report}

            if action == 'generate_code':
                code = yaml_data.get('code', '') or extract_code_from_response(response)
                if code:
                    print(f"Code to execute:\n{code}")
                    result = self.executor.execute_code(code)
                    
                    # 检查是否有图片生成，并提取相对URL路径
                    if result.get("success") and "IMAGE_PATH:" in result.get("output", ""):
                        for line in result["output"].splitlines():
                            if line.startswith("IMAGE_PATH:"):
                                path = line.split(":", 1)[1].strip()
                                image_path = os.path.relpath(path, self.base_output_dir).replace("\\", "/")
                                self.generated_images.append(image_path)
                                print(f"Image detected and stored: {image_path}")
                                # 将图片路径添加到结果中，以便前端使用
                                result['image_url'] = image_path
                    
                    feedback = format_execution_result(result)
                    print(f"Execution feedback:\n{feedback}")
                    return {'action': 'generate_code', 'code': code, 'result': result, 'feedback': feedback, 'continue': True}
                else:
                    return {'action': 'invalid_response', 'error': '响应中缺少可执行代码', 'continue': True}
            
            return {'action': action, 'continue': True, 'error': f'Unknown action: {action}'}
        except Exception as e:
            return {'action': 'error', 'error': str(e), 'continue': True}

    async def analyze_stream(self, user_input: str, files: List[str], queue: asyncio.Queue):
        self.reset()
        self.session_output_dir = create_session_output_dir(self.base_output_dir, user_input)
        self.executor = CodeExecutor(self.session_output_dir)
        self.executor.set_variable('session_output_dir', self.session_output_dir)
        
        initial_prompt = f"用户需求: {user_input}"
        if files:
            initial_prompt += f"\n数据文件: {', '.join(files)}"
        
        self.conversation_history.append({'role': 'user', 'content': initial_prompt})
        await queue.put({"type": "log", "content": f"🚀 开始数据分析任务，输出目录: {self.session_output_dir}"})

        while self.current_round < self.max_rounds:
            self.current_round += 1
            await queue.put({"type": "log", "content": f"🔄 第 {self.current_round} 轮分析开始..."})
            
            try:
                notebook_variables = self.executor.get_environment_info()
                # 使用 .replace() 而不是 .format() 来避免与提示内容中的大括号冲突
                formatted_system_prompt = data_analysis_system_prompt.replace("{notebook_variables}", str(notebook_variables))
                
                print(f"\n--- Round {self.current_round} ---")
                print(f"System Prompt: {formatted_system_prompt[:200]}...")
                print(f"User Prompt: {self._build_conversation_prompt()}")

                response_stream = self.llm.async_call_stream(
                    prompt=self._build_conversation_prompt(),
                    system_prompt=formatted_system_prompt
                )
                
                full_response = ""
                # 初始化一个空的step用于流式更新
                current_step = {
                    "type": "step", "round": self.current_round,
                    "thought": "", "code": "", "execution_result": {}
                }
                await queue.put(current_step)

                async for chunk in response_stream:
                    full_response += chunk
                    current_step["thought"] = full_response # 实时更新thought
                    await queue.put(current_step)

                process_result = self._process_response(full_response)
                
                parsed_yaml = self.llm.parse_yaml_response(full_response)
                await queue.put({
                    "type": "step", "round": self.current_round,
                    "thought": parsed_yaml.get('thought', ''),
                    "code": process_result.get('code', ''),
                    "execution_result": process_result.get('result', {}),
                })
                
                if not process_result.get('continue', True):
                    await queue.put({"type": "report", "content": process_result.get('final_report')})
                    print("--- Analysis Finished ---")
                    break
                
                self.conversation_history.append({'role': 'assistant', 'content': full_response})
                if process_result.get('feedback'):
                    self.conversation_history.append({'role': 'user', 'content': f"代码执行反馈:\n{process_result['feedback']}"})

            except Exception as e:
                error_msg = f"LLM调用或处理错误: {str(e)}"
                print(f"ERROR in round {self.current_round}: {error_msg}")
                await queue.put({"type": "error", "content": error_msg})
                break

        if self.current_round >= self.max_rounds:
            await queue.put({"type": "log", "content": f"⚠️ 已达到最大轮数 ({self.max_rounds})，分析结束"})
            await queue.put({"type": "report", "content": {"text": "分析因达到最大轮数而中止。", "images": self.generated_images}})
        
        await queue.put(None)

    def _build_conversation_prompt(self) -> str:
        return "\n\n".join([f"{msg['role']}: {msg['content']}" for msg in self.conversation_history])

    def reset(self):
        self.conversation_history = []
        self.current_round = 0
        self.session_output_dir = None
        self.executor = None
        self.generated_images = []
