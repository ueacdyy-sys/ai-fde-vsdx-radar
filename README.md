# Visio Preview & QA Linter

**⚡ 即将支持：AI协同生成 + 人工精修的完整工作流**

一个面向科研绘图和项目制图场景的 VS Code 插件：可以在 VS Code 中直接预览、轻量编辑和检查 Microsoft Visio 文件。现代 Visio 包格式（.vsdx、.vsdm、.vssx、.vssm、.vstx、.vstm）和 Visio XML 格式（.vdx、.vsx、.vtx）走语义预览与轻量编辑路径；旧二进制/旧容器格式（.vsd、.vss、.vst、.vdw、.vwi、.vsw）会被识别，并提供显式转换为现代 Visio 包的入口。

它的初衷很简单：让科研工作者、研究生、工程研究人员和需要频繁画图改图的人，不必每次都在编辑器、文件夹和 Visio 之间来回切换，也能把预览、结构检查和交付证据放进同一个工作流里。

> **🚀 新功能预告：AI辅助生成**  
> 正在开发中：通过自然语言描述生成Visio图表，AI生成初稿，人工精调细节，完美结合AI速度和人工精度。[查看开发计划](#roadmap)

这个项目由我个人维护。如果你在科研研究、论文配图、项目汇报、架构图、流程图或 Visio 文件协作中遇到任何问题，或者希望它支持新的能力，欢迎直接到 [GitHub Issues](https://github.com/ueacdyy-sys/ai-fde-vsdx-radar/issues) 提反馈和需求。只要不是特别重的功能，我都会尽量推进。也可以通过邮件联系我：ueacdyy@gmail.com。如果这个插件对你有帮助，也欢迎在 GitHub 上给一个 ⭐，这会让我更容易判断大家真正需要什么。

---

## What It Does

**当前功能：**

- Opens modern Visio package files (.vsdx, .vsdm, .vssx, .vssm, .vstx, .vstm) and Visio XML files (.vdx, .vsx, .vtx) with an interactive custom editor in VS Code.
- Supports zoom, page switching, shape dragging, direct shape resizing, connector endpoint dragging, and lightweight text edits for supported shapes.
- Handles editable shapes and connectors inside Visio groups by writing edits back to the correct local group coordinates, including Visio XML files.
- Keeps simple rotated and flipped shapes editable: they render with their stored Angle, FlipX, and FlipY transforms, can be dragged or text-edited, and preserve Angle on save.
- Resolves Visio StyleSheet and master-shape inheritance for hand-authored files, so fill, patterned fill background, line, stroke width, line cap, line rounding, dashed line patterns, connector arrow, arrow size, shadow color, shadow blur, Geometry section paint visibility, and basic text style semantics render on the fast XML/ZIP path.
- Renders connector direction, line transparency, and line semantics from Visio BeginArrow, EndArrow, LineColorTrans, and LinePattern cells, including modern package and legacy Visio XML files.
- Renders basic text formatting from Visio Color, Font, Size, Character.Style, Character.Pos, DblUnderline, Strikethru, paragraph alignment, paragraph indents, paragraph spacing, line spacing, bullet text position, TextBlock margins, TextBkgnd, and TextBkgndTrans cells, including inherited formatting from styles and legacy Visio XML files.
- Renders embedded pictures from page relationships, master relationships, and inline Visio XML image data when the file already carries that semantic image payload.
- Exports Visio files to cached PNG or PDF previews through local Microsoft Visio automation.
- Supports multi-page diagrams with one preview per page.
- Parses modern Visio package XML and Visio XML drawings, then writes .aifde/qa/*.qa.json plus .qa.md summaries.
- Recognizes legacy binary and opaque Visio files (.vsd, .vss, .vst, .vdw, .vwi, .vsw) and adds an explicit conversion command so they can become modern package files (.vsdx, .vssx, .vstx) before entering semantic QA and lightweight editing.
- Includes all recognized Visio extensions in workspace reports and the risk dashboard; legacy files are marked as LEGACY_CONVERSION_REQUIRED and expose a conversion action instead of failing silently.
- Flags common delivery risks: empty pages, duplicate Shape IDs, unlabeled shapes, low connector ratio, diagonal connectors, connectors crossing nodes, dangling connectors, overlapping shapes, page coverage issues, and out-of-bounds shapes. Missing or stale previews are shown as preview status, not content QA risks.
- Adds Explorer context menu commands for preview, QA, status, and artifact reveal actions.
- Generates workspace reports, risk reports, due-risk reports, team review boards, calendar exports, and a webview dashboard for filtering and assigning diagram risks.
- Supports QA profile templates, import/export, config diff, profile stacks, and profile audit history.

**即将推出（开发中）：**

- 🤖 **AI辅助生成**：从自然语言描述生成Visio图表
- 🔄 **实时协同编辑**：AI生成过程中随时人工调整
- 📦 **MCP协议支持**：让所有AI工具（Claude、Cursor等）都能调用
- 🎨 **智能模板库**：流程图、架构图、UML、ER图等预设模板
- 🧠 **自动质量优化**：AI自动修复常见图表问题
- 📐 **智能布局算法**：自动优化形状位置，避免重叠和交叉

---

## <a name="roadmap"></a>🗺️ Development Roadmap

### Phase 1: MCP Server基础 (Q1 2027)

为AI工具提供标准化的VSDX操作接口：

```typescript
// AI可以通过MCP调用这些工具
vsdx_create_diagram      // 从描述创建图表
vsdx_add_shapes_batch    // 批量添加形状
vsdx_connect_shapes      // 连接形状
vsdx_get_qa_report       // 质量检查
vsdx_generate_preview    // 生成预览
```

**使用场景示例：**

```
用户: "创建一个微服务架构图，包含API Gateway、用户服务、订单服务和MySQL"

AI (通过MCP):
  1. vsdx_create_diagram("架构图", "architecture")
  2. vsdx_add_shapes_batch([
       {type: "gateway", text: "API Gateway"},
       {type: "service", text: "用户服务"},
       {type: "service", text: "订单服务"},
       {type: "database", text: "MySQL"}
     ])
  3. vsdx_connect_shapes([
       {from: "API Gateway", to: "用户服务"},
       {from: "API Gateway", to: "订单服务"},
       ...
     ])
  4. vsdx_generate_preview("architecture.vsdx")

结果: 专业的架构图，30秒完成（传统需要30分钟）
```

### Phase 2: 模板与智能布局 (Q2 2027)

- 丰富的图表模板库（流程图、架构图、UML、ER图、思维导图）
- 智能布局算法（层次布局、力导向布局、树形布局）
- 连接器自动路由（避免交叉）
- 样式系统（配色方案、主题）

### Phase 3: 实时协同编辑 (Q3 2027)

- AI生成过程实时预览
- 用户随时介入调整
- AI基于调整继续生成
- 历史记录和回滚
- 版本控制

**协同流程示例：**

```
1. AI开始生成架构图...
2. 用户看到"API Gateway"位置不理想
3. 用户直接拖拽调整位置 👆
4. AI检测到调整，暂停并询问："基于新位置继续？"
5. 用户确认
6. AI基于新位置继续生成剩余组件
7. 生成完成，自动运行QA检查
8. AI修复发现的2个标签缺失问题
9. 完成！导出专业图表
```

### Phase 4: 智能优化 (Q4 2027)

- QA自动修复引擎
- 布局优化建议
- 语义理解增强
- 缺失元素推断

---

## ✨ Why This Matters

### 当前痛点

- **AI画图工具**（Mermaid, PlantUML）：纯文本，无法精确控制细节
- **手工画图**（Visio）：费时费力，效率低
- **两者割裂**：AI快速生成 ↔ 人工精修，无法无缝协作

### 我们的方案

**AI生成速度 + 人工精确控制 = 完美工作流**

```
传统流程: 30分钟手工画图
AI工具: 1分钟生成，但细节不可控

本插件: 1分钟AI生成 + 5分钟人工精修 = 6分钟完成专业图表
```

### 目标用户

- 🎓 **科研工作者**：论文配图、实验流程图
- 👨‍💻 **软件工程师**：系统架构图、流程图、UML
- 📊 **产品经理**：用户旅程图、业务流程图
- 📚 **学生**：思维导图、课程笔记图
- 🏢 **企业团队**：协作图表、项目文档

---

## Requirements

**当前功能需求：**

- VS Code 1.90 or newer
- Windows with PowerShell 7.6.2 available as pwsh
- Microsoft Visio for Windows with a usable local license for high-fidelity preview export
- Local filesystem workspace; virtual and untrusted workspaces are intentionally disabled

**AI功能需求（开发中）：**

- Node.js 18+ (for MCP Server)
- Optional: Claude Desktop, Cursor, or other MCP-compatible AI tools

The QA linter reads modern Visio package XML and Visio XML drawings locally. High-fidelity preview export and explicit legacy conversion require Visio COM automation. Legacy binary and opaque Visio files can be recognized, but semantic QA and lightweight editing require conversion to a modern Visio package first.

---

## Quick Start

### 当前版本

1. Open a workspace containing modern Visio package files
2. Open a .vsdx, .vsdm, .vssx, .vssm, .vstx, .vstm, .vdx, .vsx, or .vtx file directly
3. The extension opens the interactive Visio editor by default
4. Use the toolbar to switch pages, zoom, save, reveal the source file, or open settings
5. Drag supported shapes or connector endpoints, or edit text from the side panel
6. Run `AI-FDE: Export Preview and QA` when you need cached PNG/PDF previews and QA evidence
7. For legacy files, run `AI-FDE: 转换旧 Visio 为现代格式 / Convert Legacy Visio to Modern Package` first

### AI功能（即将推出）

```bash
# 安装MCP Server
npm install -g @ai-fde-lab/vsdx-mcp

# 配置AI客户端（Claude Desktop示例）
# 在 ~/.config/Claude/mcp.json 添加：
{
  "mcpServers": {
    "vsdx": {
      "command": "vsdx-mcp"
    }
  }
}

# 使用AI生成图表
在VS Code命令面板中：
> AI-FDE: Generate Diagram from Prompt

输入: "创建一个包含5个步骤的用户注册流程图"
结果: 自动生成专业流程图，可立即手动调整
```

---

## Useful Commands

**当前可用：**

- AI-FDE: 打开 VSDX 交互预览 / Open Interactive VSDX Editor
- AI-FDE: 转换旧 Visio 为现代格式 / Convert Legacy Visio to Modern Package
- AI-FDE: Export Preview and QA
- AI-FDE: Open VSDX Preview
- AI-FDE: Open All VSDX Previews
- AI-FDE: Open VSDX QA Report
- AI-FDE: Show VSDX Status
- AI-FDE: Reveal VSDX Artifacts
- AI-FDE: Generate Workspace VSDX Report
- AI-FDE: Generate Workspace VSDX Risk Report
- AI-FDE: Open Workspace VSDX Risk Dashboard
- AI-FDE: Generate VSDX Demo Pack

**即将推出：**

- AI-FDE: Generate Diagram from Description
- AI-FDE: Generate Diagram from Code/Data
- AI-FDE: AI-Assisted Diagram Refinement
- AI-FDE: Apply Smart Layout
- AI-FDE: Auto-Fix QA Issues

---

## Output Layout

```
.aifde/
  previews/                # PNG/PDF preview cache
  qa/                      # Per-file QA JSON and Markdown summaries
  reports/                 # Workspace, risk, team, config, and demo reports
  acceptance/              # Local release acceptance reports
  cache-index.json         # Preview freshness and QA cache metadata
```

---

## QA Evidence

Each QA JSON report includes:

- Source path and source modified time
- Preview path, preview freshness state, and freshness reasons
- Page, shape, text shape, unlabeled shape, connector, route, crossing, overlap, and coverage statistics
- Risk list with severity, code, page, and message

The Markdown summary mirrors the same evidence for human review.

---

## Dashboard And Reports

The workspace dashboard helps teams triage diagram delivery risk:

- Filter by status, risk code, preview freshness reason, owner, processing status, and keyword
- Sort by priority, due date, owner, status, or file name
- Assign owner, due date, processing state, and remediation notes
- Export due-risk items to an .ics calendar file
- Generate team-board reports for standups or design reviews

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| aiFdeVsdxRadar.pwshPath | pwsh | PowerShell 7.6.2 executable path |
| aiFdeVsdxRadar.outputDirectory | .aifde | Workspace-relative artifact directory |
| aiFdeVsdxRadar.previewFormat | png | Preview format: png or pdf |
| aiFdeVsdxRadar.qaPreset | custom | QA preset: custom, balanced, strict, or quiet |
| aiFdeVsdxRadar.autoExportOnSave | false | Automatically export preview and QA when supported modern Visio package files change |
| aiFdeVsdxRadar.exportTimeoutMs | 120000 | Visio export timeout in milliseconds |
| aiFdeVsdxRadar.convertTimeoutMs | 300000 | Explicit legacy Visio conversion timeout in milliseconds |

Additional settings expose QA thresholds and switches for shape density, connector ratio, unlabeled shapes, page coverage, diagonal connectors, connector crossings, dangling connectors, and shape overlap checks.

---

## 🤝 Contributing

欢迎贡献！特别是AI集成相关的功能。

**开发分支：**
- `main` - 稳定版本
- `feature/mcp-integration` - AI功能开发分支

**如何贡献：**
1. Fork this repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**优先需要帮助的领域：**
- 🤖 MCP Server实现
- 🎨 图表模板设计
- 📐 布局算法优化
- 🧪 测试用例编写
- 📝 文档和教程

---

## Local Verification

```bash
npm install
npm run marketplace:assets
npm run marketplace:check
npm run verify
npm run smoke:visio:convert
npm run qa:evidence
npm run demo:pack
npm run demo:pack:check:strict
npm run package
```

Full local release gate:
```bash
npm run acceptance
```

The acceptance gate verifies manifest contributions, QA fixtures, single-page and multi-page Visio export, real Visio QA smoke tests, QA evidence generation, VSIX packaging, local VSIX installation, and strict Demo Pack freshness.

---

## Marketplace Publishing

The proposed extension ID is: `ai-fde-lab.ai-fde-vsdx-radar`

Before publishing, confirm the final Marketplace publisher ID and GitHub repository. If they differ, update publisher, repository, bugs, and homepage in package.json, then rerun:

```bash
npm run marketplace:check
npm run acceptance
```

See docs/publishing.md for the release checklist.

---

## 📧 Feedback And Contact

This is a personal-maintained project for people who want a more convenient Visio and research-diagram workflow inside VS Code. Feedback, bug reports, and feature requests are very welcome:

- **GitHub Issues**: https://github.com/ueacdyy-sys/ai-fde-vsdx-radar/issues
- **Email**: ueacdyy@gmail.com
- **GitHub Star**: ⭐ https://github.com/ueacdyy-sys/ai-fde-vsdx-radar

**For AI integration discussions:**
- Join the discussion in [GitHub Discussions](https://github.com/ueacdyy-sys/ai-fde-vsdx-radar/discussions)
- Follow development progress on the `feature/mcp-integration` branch

---

## 📚 Resources

- [Development Roadmap](docs/roadmap.md) - Detailed AI integration plan
- [Technical Design](docs/technical-design.md) - Architecture and implementation details
- [Quick Start Guide](docs/quickstart.md) - 30-day MVP development guide
- [MCP Protocol Docs](https://modelcontextprotocol.io/)

---

## ⭐ Star History

如果这个项目对你有帮助，请给个Star支持一下！这会激励我继续开发AI集成功能。

---

## Limitations

**当前版本：**

- Preview export is Windows-only because it uses local Visio COM automation
- Legacy conversion is explicit and may be slow because it launches local Microsoft Visio; it is intentionally not run during normal file open
- QA rules are structural and heuristic; they complement but do not replace human diagram review
- This first public release is marked as Preview in the Marketplace

**AI功能（开发中）限制：**

- MVP阶段仅支持基础图表类型
- 复杂图表可能需要更多人工调整
- 语义理解能力持续改进中

---

## License

[MIT License](LICENSE) - See LICENSE file for details

---

## Acknowledgments

感谢所有使用和反馈这个项目的用户！特别感谢：

- Microsoft Visio团队的文件格式文档
- VS Code扩展开发社区
- Model Context Protocol (MCP)社区
- 所有提Issue和建议的贡献者

---

<div align="center">

**让画图变得更简单、更智能！**

[⭐ Star](https://github.com/ueacdyy-sys/ai-fde-vsdx-radar) · [🐛 Report Bug](https://github.com/ueacdyy-sys/ai-fde-vsdx-radar/issues) · [💡 Request Feature](https://github.com/ueacdyy-sys/ai-fde-vsdx-radar/issues)

</div>
