# AI-FDE VSDX Radar Demo Script

本脚本用于 5 分钟演示 AI-FDE VSDX Radar 的核心价值：在 VS Code 中把 Visio `.vsdx` 文件转成可追踪的预览缓存和 QA 证据。

## 演示前准备

```bash +code
npm run acceptance
npm run demo:pack
code .
```

确认 VS Code 已安装当前版本：

```bash +code
code --list-extensions --show-versions | Select-String "ai-fde-vsdx-radar"
```

建议演示文件：

- `test/fixtures/visio-com-smoke.vsdx`
- `test/fixtures/visio-com-multipage-smoke.vsdx`
- `test/fixtures/minimal.vsdx`
- `test/fixtures/connector-route-corpus.vsdx`
- `test/fixtures/business-process-corpus.vsdx`
- `test/fixtures/local-geometry-route-corpus.vsdx`
- `test/fixtures/transformed-local-geometry-route-corpus.vsdx`
- `test/fixtures/container-boundary-corpus.vsdx`
- `test/fixtures/endpoint-connector-evidence-corpus.vsdx`
- `test/fixtures/group-nested-corpus.vsdx`
- `test/fixtures/group-parent-child-connects-corpus.vsdx`
- `test/fixtures/group-local-geometry-route-corpus.vsdx`
- `test/fixtures/rotated-group-local-geometry-route-corpus.vsdx`
- `test/fixtures/flipped-group-local-geometry-route-corpus.vsdx`
- `test/fixtures/nested-transformed-group-local-geometry-route-corpus.vsdx`
- `test/fixtures/duplicate-shape-id-multipage-corpus.vsdx`
- `test/fixtures/duplicate-shape-id-same-page-group-corpus.vsdx`
- `test/fixtures/duplicate-connector-id-same-page-corpus.vsdx`
- `test/fixtures/invalid-connects-multipage-corpus.vsdx`

## 讲解主线

1. 问题背景：FDE 过程里 `.vsdx` 图纸经常脱离代码审查和交付证据链。
2. 插件价值：在 VS Code 里为 `.vsdx` 建立预览缓存、QA JSON、Markdown 摘要和状态徽章。
3. 关键闭环：导出预览、运行 QA、打开所有页面、定位产物、查看状态、生成工作区报告、查看负责人汇总和打开风险 Dashboard。
4. 验收证据：`npm run acceptance` 已覆盖命令贡献、单页/多页 Visio COM 导出、打包和安装确认。

## 5 分钟流程

### 0:00 - 0:40 背景

- 打开 VS Code 项目根目录。
- 展示资源管理器中的 `test/fixtures/*.vsdx`。
- 说明 `.vsdx` 在工程交付中需要可视化预览和自动化 QA 证据。

### 0:40 - 1:40 单页主流程

- 右键 `visio-com-smoke.vsdx`。
- 执行 `AI-FDE: Export Preview and QA`。
- 展示输出面板中的 `[preview:...]` 和 `[qa]`。
- 打开 `.aifde/previews` 中生成的 PNG。
- 打开 `.aifde/qa` 中生成的 `.qa.md`。

### 1:40 - 2:40 多页预览

- 右键 `visio-com-multipage-smoke.vsdx`。
- 执行 `AI-FDE: Export VSDX Preview`。
- 执行 `AI-FDE: Open All VSDX Previews`。
- 展示 3 个 PNG 预览页。
- 强调第一页是主预览，后续页面使用 `page-2/page-3` 后缀。

### 2:40 - 3:30 QA 风险

- 打开 `minimal.vsdx` 的 QA 摘要。
- 展示直线连接、正交折线连接、复杂路由连接、悬空连接线的统计，以及斜线连接、连接线穿节点、形状重叠、越界和页面覆盖率等规则。
- 打开 `connector-route-corpus.vsdx` 的 QA 摘要，说明多折点正交路由会计入 complex connector，但不会误报斜线或穿节点。
- 打开 `business-process-corpus.vsdx` 的 QA 摘要，说明标准业务流程样例可保持 3 条直线连接、无悬空连接线且无风险。
- 打开 `local-geometry-route-corpus.vsdx` 的 QA 摘要，说明只有 `BeginX/BeginY/EndX/EndY` 的 Visio 连接线也能被识别，本地 `Geometry` 坐标会转换为页面坐标后判断为正交折线。
- 打开 `transformed-local-geometry-route-corpus.vsdx` 的 QA 摘要，说明旋转和翻转后的本地 `Geometry` 路由也会还原为正交折线。
- 打开 `container-boundary-corpus.vsdx` 的 QA 摘要，说明容器完整包含内部节点不会触发 `SHAPE_OVERLAP`。
- 打开 `endpoint-connector-evidence-corpus.vsdx` 的 QA 摘要，说明只有端点单元格的连接线会作为连接证据，不会触发 `NO_CONNECTORS`，但缺少 `Connects` 时仍会触发悬空连接线告警。
- 打开 `group-nested-corpus.vsdx` 的 QA 摘要，说明 group 内部子节点和连接线会展开并转换到页面坐标参与 QA。
- 打开 `group-parent-child-connects-corpus.vsdx` 的 QA 摘要，说明 `Connects` 同时指向父 group 和子 shape 时仍会作为当前页有效连接证据，不会误报悬空连接或穿节点。
- 打开 `group-local-geometry-route-corpus.vsdx` 的 QA 摘要，说明分组内部连接线的本地 `Geometry` 路由也会还原为正交折线。
- 打开 `rotated-group-local-geometry-route-corpus.vsdx` 的 QA 摘要，说明父 group 旋转后分组内本地 `Geometry` 路由仍不会误报斜线。
- 打开 `flipped-group-local-geometry-route-corpus.vsdx` 的 QA 摘要，说明父 group 翻转后分组内本地 `Geometry` 路由仍不会误报斜线。
- 打开 `nested-transformed-group-local-geometry-route-corpus.vsdx` 的 QA 摘要，说明外层旋转和内层翻转组合后，最内层本地 `Geometry` 路由仍会还原为正交折线。
- 打开 `duplicate-shape-id-multipage-corpus.vsdx` 的 QA 摘要，说明不同页面重复 Shape ID 时，`Connects` 只按当前页面计算，第二页缺少连接证据仍会单独触发悬空连接线告警。
- 打开 `duplicate-shape-id-same-page-group-corpus.vsdx` 的 QA 摘要，说明同一页重复 Shape ID 会触发 `DUPLICATE_SHAPE_IDS`，且重复 ID 不会再作为跳过穿节点的可靠端点证据。
- 打开 `duplicate-connector-id-same-page-corpus.vsdx` 的 QA 摘要，说明同一页重复连接线 ID 会触发 `DUPLICATE_SHAPE_IDS`，且重复连接线的 `FromSheet` 证据会降级为悬空连接线风险。
- 打开 `invalid-connects-multipage-corpus.vsdx` 的 QA 摘要，说明 `Connects` 指向当前页不存在或只存在于其他页面的 Shape ID 时，不会抵消悬空连接线告警。
- 说明连接线穿节点检测会基于当前页有效且 ID 唯一的 `Connects` 跳过合法连接端点。
- 说明斜线判断会读取实际路由段，正交折线不会仅因起终点呈斜向而误报。
- 打开 `docs/qa-rules.md`，说明每条规则都有触发条件、配置影响和整改建议。

### 3:30 - 4:20 状态与产物

- 执行 `AI-FDE: Show VSDX Status`。
- 执行 `AI-FDE: Reveal VSDX Artifacts`。
- 展示 `.aifde/previews`、`.aifde/qa` 和 `.aifde/cache-index.json`。
- 从命令面板执行 `AI-FDE: Generate Workspace VSDX Report`。
- 展示 `.aifde/reports/workspace-vsdx-report.md`。
- 强调 `Attention Needed` 区块会优先列出非 `OK` 文件。
- 展示 `Owner Summary` 和 `Preview Freshness Summary` 区块，说明它们分别按负责人和缓存失效原因汇总风险。
- 从命令面板执行 `AI-FDE: Generate Workspace VSDX Risk Report`。
- 展示 `.aifde/reports/workspace-vsdx-risk-report.md` 只包含非 `OK` 文件。
- 从命令面板执行 `AI-FDE: Generate Workspace Due VSDX Risk Report`。
- 展示 `.aifde/reports/workspace-vsdx-due-risk-report.md` 只包含逾期或 7 天内到期的非 `OK` 文件。
- 从命令面板执行 `AI-FDE: Export Workspace Due VSDX Risk Calendar`。
- 展示 `.aifde/reports/workspace-vsdx-due-risk-calendar.ics`，说明它可导入日历或提醒系统。
- 从命令面板执行 `AI-FDE: Show Workspace Due VSDX Risk Reminder`。
- 展示提醒弹窗中的逾期和 7 天内到期数量，以及 `Open Dashboard`、`Generate Due Report`、`Open Next Due Risk` 动作。
- 从命令面板执行 `AI-FDE: Generate Workspace VSDX Team Review Board`。
- 展示 `.aifde/reports/workspace-vsdx-team-board.md` 中的 `Board Summary`、`Owner Workload` 和 New/Reviewing/Accepted/Resolved 风险泳道。
- 从命令面板执行 `AI-FDE: Generate QA Config Template`。
- 展示 `.aifde/reports/qa-config-template.md` 中的当前有效配置、团队 profile 和 namespace。
- 从命令面板执行 `AI-FDE: Generate QA Profile Strategy Template`。
- 展示 `.aifde/reports/qa-profile-strategy-template.md` 中的命名策略、适用场景、profile 顺序和合并后的有效设置。
- 从命令面板执行 `AI-FDE: Export QA Config`。
- 展示 `.aifde/reports/qa-config-export.md`，说明它可用于跨工作区共享当前有效 QA 设置。
- 从命令面板执行 `AI-FDE: Generate QA Config Diff Report`，选择刚导出的 `.aifde/reports/qa-config-export.json`。
- 展示 `.aifde/reports/qa-config-diff.md` 中的 changed、missing-in-source 和 same 统计。
- 再选择 `.aifde/reports/qa-config-template.json`，展示 QuickPick 可选择 `currentEffectiveConfig` 或 `profile:<name>`。
- 从命令面板执行 `AI-FDE: Import QA Config`，选择刚导出的 `.aifde/reports/qa-config-export.json`。
- 展示输出面板中的 `[qa-config-import]` 和 `candidate=...`，说明导入只写入已知且类型合法的配置项。
- 从命令面板执行 `AI-FDE: Roll Back QA Config`，选择刚才导入前的审计记录。
- 展示输出面板中的 `[qa-config-rollback]`，说明它会恢复该条目前的 QA 设置。
- 从命令面板执行 `AI-FDE: Apply QA Config Profile`，选择一个团队 profile，说明它会写入工作区设置。
- 从命令面板执行 `AI-FDE: Apply QA Config Profile Stack`，选择多个 namespace/profile，说明后选 profile 会覆盖先选 profile 的同名设置。
- 从命令面板执行 `AI-FDE: Apply QA Profile Strategy`，选择 `delivery-readiness`、`inventory-baseline` 或 `layout-triage`，说明它会按策略顺序应用 profile stack。
- 展示 `.aifde/reports/qa-profile-audit.json` 中记录的 profile 应用审计条目。
- 从命令面板执行 `AI-FDE: Open QA Profile Audit Report`。
- 展示 `.aifde/reports/qa-profile-audit.md` 中按时间倒序整理的 profile 应用历史、`import:<文件名>` 来源和 `rollback:<来源>` 记录。
- 从命令面板执行 `AI-FDE: Open Workspace VSDX Risk Dashboard`。
- 展示 Dashboard 中的状态筛选、风险码筛选、缓存失效原因筛选、处理状态筛选、负责人筛选、分组选择、关键词搜索、`Reset filters`、顶部可点击下钻的 `Preview Freshness Summary`、`Status detail` 缓存失效原因、逾期统计和打开源文件/QA/预览按钮。
- 切换 `Sort by due date` 和 `Sort by owner`，展示风险明细按到期时间或负责人重排。
- 在负责人汇总表中点击一个负责人，展示明细列表按该负责人下钻过滤。
- 在 Dashboard 中修改一条风险的处理状态、负责人、到期时间和整改备注，展示 `.aifde/reports/workspace-vsdx-notes.json`。
- 选择可见风险项，批量设置处理状态、负责人、到期时间和整改备注。
- 从命令面板执行 `AI-FDE: Open Highest Priority VSDX Risk`。
- 展示插件会打开最高优先级风险的 QA 摘要。
- 从命令面板执行 `AI-FDE: Open Next Due VSDX Risk`。
- 展示插件会优先打开逾期或最早到期风险的 QA 摘要。
- 从命令面板执行 `AI-FDE: Open All VSDX Risk Reports`。
- 展示插件批量打开所有非 `OK` 文件的 QA 摘要。

### 4:20 - 5:00 验收证据

- 打开最新 `.aifde/acceptance/acceptance-*.md`。
- 展示 `Status: PASS`。
- 展示 `check manifest contributions`、`npm run verify`、`npm run package`、`install VSIX` 和 `check installed extension` 全部为 `0`。
- 从命令面板执行 `AI-FDE: Generate VSDX Demo Pack`。
- 展示 `.aifde/reports/demo-pack.md` 中的 `Preview Freshness Summary`、预览图 gallery、artifact index 和 presenter storyboard。
- 如果现场不方便从命令面板生成，可先执行 `npm run demo:pack` 刷新同一份 Demo Pack。

## 备用说明

- 如果现场没有 Visio 授权，说明 XML QA 能继续扩展，但高保真 PNG/PDF 导出需要本机 Visio COM。
- 如果 VS Code 没有刷新菜单，重载窗口后再次右键 `.vsdx`。
- 如果预览显示旧版本，执行 `AI-FDE: Export Preview and QA` 重新生成缓存。
