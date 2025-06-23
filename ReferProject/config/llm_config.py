# -*- coding: utf-8 -*-
"""
配置管理模块
"""

import os
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict


from dotenv import load_dotenv
load_dotenv()



@dataclass
class LLMConfig:
    """LLM配置"""

    provider: str = "dashscope"  # openai, dashscope, etc.
    api_key: str = os.environ.get("DASHSCOPE_API_KEY", "")
    base_url: str = os.environ.get("DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
    model: str = os.environ.get("DASHSCOPE_MODEL", "qwen-turbo")
    temperature: float = 0.1
    max_tokens: int = 8192

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'LLMConfig':
        """从字典创建配置"""
        return cls(**data)

    def validate(self) -> bool:
        """验证配置有效性"""
        if not self.api_key:
            raise ValueError("DASHSCOPE_API_KEY is required")
        if not self.base_url:
            raise ValueError("DASHSCOPE_BASE_URL is required")
        if not self.model:
            raise ValueError("DASHSCOPE_MODEL is required")
        return True
