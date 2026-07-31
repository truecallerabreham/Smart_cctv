from typing import Any, Dict, Optional
from pydantic import BaseModel


class LLMParameter(BaseModel):
    """Represents a parameter in an OpenAI-compatible tool definition."""

    type: str
    description: str
    default: Optional[Any] = None


class LLMParameters(BaseModel):
    """Represents the parameters object in an OpenAI-compatible tool definition."""

    type: str = "object"
    properties: Dict[str, LLMParameter]
    required: Optional[list[str]] = None


class LLMFunction(BaseModel):
    """Represents a function in an OpenAI-compatible tool definition."""

    name: str
    description: str
    parameters: LLMParameters


class LLMTool(BaseModel):
    """Represents an OpenAI-compatible tool definition."""

    type: str = "function"
    function: LLMFunction

    @classmethod
    def from_mcp_tool(cls, tool) -> "LLMTool":
        """Create an LLMTool instance from an MCP Tool."""
        properties = {}

        for field_name, field_info in tool.inputSchema["properties"].items():
            properties[field_name] = LLMParameter(
                type=field_info["type"],
                description=field_info["title"],
                default=field_info.get("default"),
            )

        parameters = LLMParameters(
            properties=properties, required=tool.inputSchema.get("required")
        )

        function = LLMFunction(
            name=tool.name, description=tool.description, parameters=parameters
        )

        return cls(function=function)


def transform_tool_definition(tool) -> dict:
    """Transform an MCP tool into an OpenAI-compatible tool definition dictionary."""
    return LLMTool.from_mcp_tool(tool).model_dump()
