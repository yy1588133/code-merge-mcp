[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/yy1588133-code-merge-mcp-badge.png)](https://mseep.ai/app/yy1588133-code-merge-mcp)

# Code Merge MCP 服务器

Code Merge MCP 是一个基于 Model Context Protocol (MCP) 的服务器实现，专为代码文件内容提取、合并和分析而设计。它提供了一套强大的工具，帮助大语言模型（如GPT、Claude）更有效地处理和分析代码库。

## 核心功能

- **文件树生成**：生成项目文件结构的树状视图
- **代码合并**：将多个文件的内容合并为单一输出
- **代码分析**：提供代码统计信息，如行数和函数数量
- **智能过滤**：支持 .gitignore 规则和自定义黑名单

## 技术架构

本项目基于 Model Context Protocol (MCP) SDK 构建，使用 Node.js 实现。主要组件包括：

- **MCP 服务器**：处理客户端请求并提供工具功能
- **工具模块**：实现各种代码处理功能
- **核心库**：提供文件系统操作和过滤功能

## 工具说明

### 1. `get_file_tree`

生成项目文件结构的树状视图，支持多种过滤选项。

**参数**：
- `path`：目标目录路径
- `use_gitignore`：是否使用 .gitignore 规则（可选）
- `ignore_git`：是否忽略 .git 目录（可选）
- `custom_blacklist`：自定义黑名单项目（可选）

**示例输出**：
```
project/
├── src/
│   ├── main.js
│   └── utils/
│       └── helper.js
├── tests/
│   └── test.js
└── README.md
```

### 2. `merge_content`

将多个文件的内容合并为单一输出，适合准备用于大语言模型的代码分析。

**参数**：
- `path`：目标文件或目录路径
- `compress`：是否压缩输出（可选）
- `use_gitignore`：是否使用 .gitignore 规则（可选）
- `ignore_git`：是否忽略 .git 目录（可选）
- `custom_blacklist`：自定义黑名单项目（可选）

**输出**：包含合并后的文件内容和统计信息

### 3. `analyze_code`

分析代码文件并提供统计信息，如行数和函数数量。

**参数**：
- `path`：目标文件或目录路径
- `language`：可选的语言过滤器
- `countLines`：是否统计代码行数
- `countFunctions`：是否统计函数数量

**输出**：包含代码分析结果的统计信息

## 安装与使用

### 环境要求

- Node.js (v16.x 或更高版本推荐)
- npm (通常随 Node.js 一起安装)

### 从 Git 仓库获取项目

```bash
# 克隆仓库
git clone https://github.com/yourusername/code-merge-mcp.git
cd code-merge-mcp

# 安装依赖
npm install
```

### VS Code 配置

在 VS Code 的 mcp_settings.json 中添加：

```json
{
  "mcpServers": {
    "code-merge": {
      "command": "node",
      "args": [
        "<项目完整路径>/src/main.js"
      ],
    }
  }
}
```

将 `<项目完整路径>` 替换为实际路径，例如 `C:\Users\username\code-merge-mcp`。


## 项目结构

```
code-merge-mcp/
├── bin/                # 可执行文件目录
│   ├── cli.js           # 命令行入口点
│   └── mcp-server.js    # MCP服务器入口点
├── src/
│   ├── core/           # 核心功能模块
│   │   ├── compressor.js   # 内容压缩
│   │   ├── file-lister.js  # 文件列表生成
│   │   ├── file-reader.js  # 文件读取
│   │   └── filter.js       # 文件过滤
│   ├── tools/          # 工具实现
│   │   ├── analyze_code.js  # 代码分析工具
│   │   ├── get_file_tree.js # 文件树生成工具
│   │   └── merge_content.js # 内容合并工具
│   ├── main.js         # 主入口点
│   └── mcp-server.js   # MCP 服务器实现
├── package.json        # 项目配置
└── README.md           # 项目文档
```

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个工具。在提交代码前，请确保：

1. 代码符合项目的编码规范
2. 添加适当的测试用例
3. 更新相关文档

## 许可证

MIT License

## 致谢

本项目基于 [TownBoats/codeMerge](https://github.com/TownBoats/codeMerge) 开发，感谢原作者的贡献。
