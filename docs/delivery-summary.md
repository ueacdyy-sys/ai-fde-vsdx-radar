# AI-FDE VSDX Radar Delivery Summary

## 交付概览

AI-FDE VSDX Radar 是一个 VS Code 插件 MVP，用于把 Visio `.vsdx` 图纸纳入 FDE 工程交付链路。当前版本提供预览导出、QA 摘要、资源管理器状态徽章、多页预览打开、产物目录定位、工作区汇总报告、到期风险报告、到期风险日历导出、到期风险提醒、团队评审看板、Demo Pack、QA 配置模板、QA profile 策略模板、QA 配置导入导出、QA 配置差异对比、QA 配置回滚、QA profile 命名空间、QA profile stack/strategy 应用与审计报告、负责人汇总与下钻、风险 Dashboard 和本地验收报告。

## 核心能力

- `.vsdx` 右键菜单集成 8 个 AI-FDE 文件级命令
- 命令面板集成工作区级 VSDX 汇总报告、非 `OK` 风险报告、到期风险报告、到期风险日历导出、到期风险提醒、团队评审看板、Demo Pack、QA 配置模板、QA profile 策略模板、QA 配置导出、QA 配置导入、QA 配置差异报告、QA 配置回滚、QA profile 应用、QA profile stack 应用、QA profile strategy 应用、QA profile 审计报告打开、风险 Dashboard、最高优先级风险打开、下一条到期风险打开和全部风险报告打开命令
- 通过 PowerShell 7.6.2 + Visio COM 导出 PNG/PDF 预览
- PNG 多页导出支持 `page-2/page-3` 后缀
- 基于 `.vsdx` XML 生成 QA JSON 和 Markdown 摘要
- QA 统计区分直线连接、正交折线连接、复杂路由连接、悬空连接线和重复 Shape ID
- 连接线识别兼容 `OneD`、connector/连接线命名和 `BeginX/BeginY/EndX/EndY` 端点单元格
- 连接线路由解析会在页面坐标不匹配时尝试将 Visio 本地 `Geometry` 坐标转换为页面坐标，并应用 `Angle`、`FlipX`、`FlipY` 变换，减少正交折线斜线误报
- 形状重叠检测会跳过完整包含关系，降低容器、分组边界和泳道包住内部节点时的误报
- 嵌套 group 子形状会递归展开，并将子形状局部坐标转换到页面坐标后参与统计、重叠、越界、连接线和路由判断
- 分组内连接线的本地 `Geometry` 路由会在子形状坐标转换后继续还原为正交折线，父 group 旋转或翻转后也能降低 grouped flow 的斜线误报
- `test:qa` 生成最小风险 fixture、`connector-route-corpus.vsdx` 路由样例、`business-process-corpus.vsdx` 业务流程正向样例、`local-geometry-route-corpus.vsdx` 本地几何坐标样例、`transformed-local-geometry-route-corpus.vsdx` 旋转/翻转本地坐标样例、`container-boundary-corpus.vsdx` 容器边界样例、`endpoint-connector-evidence-corpus.vsdx` 端点连接线证据样例、`group-nested-corpus.vsdx` 嵌套分组样例、`group-parent-child-connects-corpus.vsdx` 父/子 group 混合连接证据样例、`group-local-geometry-route-corpus.vsdx` 分组内本地几何路由样例、`rotated-group-local-geometry-route-corpus.vsdx` 旋转父 group 本地路由样例、`flipped-group-local-geometry-route-corpus.vsdx` 翻转父 group 本地路由样例、`nested-transformed-group-local-geometry-route-corpus.vsdx` 多层 group 组合变换样例、`duplicate-shape-id-multipage-corpus.vsdx` 跨页重复 Shape ID 样例、`duplicate-shape-id-same-page-group-corpus.vsdx` 同页重复 Shape ID 样例、`duplicate-connector-id-same-page-corpus.vsdx` 同页重复连接线 ID 样例和 `invalid-connects-multipage-corpus.vsdx` 无效/跨页 `Connects` 样例，验证风险规则、复杂路由分类、干净业务图通过路径、本地坐标正交路由、容器包含关系、`NO_CONNECTORS` 证据判定、group 子形状展开、父/子 group 混合连接证据、分组内本地路由还原、旋转父 group 路由还原、翻转父 group 路由还原、递归组合变换、页级 `Connects` 隔离、同页重复 Shape ID 连接证据降级、重复连接线 ID 连接证据降级和无效连接目标过滤
- 汇总所有 `.vsdx` 的徽章、错误/风险数量、风险码和 QA 摘要路径，并按风险优先级排序
- 工作区报告提供 `Attention Needed` 区块，优先展示非 `OK` 文件
- 工作区报告和团队评审看板提供 `Preview Freshness Summary`，按原因类别汇总缓存失效数量和样例文件
- 风险报告只输出非 `OK` 文件，适合专项整改和交付复盘
- 到期风险报告只输出逾期或 7 天内到期的非 `OK` 文件，适合日常提醒和交付冲刺
- 到期风险日历会导出 `.aifde/reports/workspace-vsdx-due-risk-calendar.ics`，把设置了到期日的非 `OK` 文件写为全天日历事件
- 到期风险提醒会弹出逾期和 7 天内到期统计，并提供打开 Dashboard、生成到期报告或打开下一条到期风险的动作
- 团队评审看板会生成 `.aifde/reports/workspace-vsdx-team-board.json` 和 `.md`，按处理状态拆分风险泳道，并展示负责人、逾期、7 天内到期和下一到期日
- Demo Pack 会生成 `.aifde/reports/demo-pack.json` 和 `.md`，汇总 VSIX、最新验收报告新鲜度、预览图、QA 摘要、关键报告、fixture、`Preview Freshness Summary` 和演示 storyboard
- Demo Pack Markdown 包含预览图 gallery，可直接展示真实 Visio PNG 预览和多页预览资产
- Demo Pack 支持命令面板和 `npm run demo:pack` 双入口，便于本机验收阶段自动刷新演示材料；命令面板入口会实时扫描当前工作区，CLI 入口会从现有工作区/风险/团队报告 JSON 复用 `Preview Freshness Summary`，`npm run demo:pack:check` 可轻量校验 PowerShell 7.6.2、Demo Pack 版本、当前 VSIX artifact、最新验收报告新鲜度、artifact 数量、预览 gallery、storyboard 和 Preview Freshness 字段；`npm run demo:pack:check:strict` 会要求最新 acceptance 匹配当前版本，适合作为发布前硬门禁
- 工作区报告和风险报告提供 `Owner Summary` 区块，按负责人汇总总数、风险数、逾期数、7 天内到期数和处理状态
- 风险 Dashboard 支持按状态、风险码、缓存失效原因、处理状态、负责人和关键词筛选，提供 `Reset filters` 一键恢复默认筛选，并支持按状态、处理状态、负责人、到期状态或风险码分组
- 风险 Dashboard 会展示 `Status detail` 列和顶部 `Preview Freshness Summary`，缓存过期时直接显示并汇总预览失效原因，并支持点击原因汇总行下钻过滤相关文件
- 风险 Dashboard 支持按风险优先级、到期时间、负责人、处理状态或文件名排序
- 风险 Dashboard 提供负责人汇总表，点击负责人可下钻过滤风险明细
- 风险 Dashboard 可记录每个 `.vsdx` 的处理状态、负责人、到期时间和整改备注，并持久化到 `.aifde/reports/workspace-vsdx-notes.json`
- 风险 Dashboard 支持选择可见行并批量设置处理状态、负责人、到期时间和整改备注
- 风险 Dashboard 顶部展示负责人数量、逾期数量和 7 天内到期数量
- 可一键打开最高优先级风险的 QA 摘要，缺少摘要时回退打开源 `.vsdx`
- 可一键打开下一条到期风险，按逾期、7 天内到期、未来到期和无到期日排序，缺少摘要时回退打开源 `.vsdx`
- 可一键打开所有非 `OK` 文件的 QA 摘要，缺少摘要时回退打开源 `.vsdx`
- 缓存索引记录源文件 mtime、size、SHA-256 hash 和主 PNG 预览宽高，导出命令与 QA 报告共用同一套预览新鲜度判断
- 预览缓存复用前会校验 PNG 签名、`IHDR` 宽高或 PDF 文件头；常见非交错 8-bit PNG 还会解压 `IDAT` 并检查非白/非透明像素，坏预览或空白预览会触发缓存过期
- QA JSON 和 Markdown 摘要会输出 `previewFreshnessReasons`，保留 hash 失配、预览缺失、文件格式损坏或空白 PNG 等具体缓存失效原因
- 状态徽章覆盖缺缓存、缓存过期、QA 缺失、错误、风险和正常状态
- 缓存过期状态会在状态 tooltip、`Show VSDX Status` 输出、工作区报告、团队评审看板和 Dashboard 中展示具体 `previewFreshnessReasons`，并在工作区级报告和 Dashboard 中按原因聚合；Dashboard 可按聚合后的原因过滤明细
- `Preview Freshness Summary` 的原因归一化、Dashboard 过滤 key、聚合和样例文件格式化已抽为共享模块，并由 `test:qa` fixture 覆盖动态 mtime/size 原因、坏 PNG 原因、过滤 key 去重排序和样例文件截断
- QA 规则覆盖空页、页面尺寸、重复 Shape ID、连接线比例、连接线路由、斜线连接、连接线穿节点、悬空连接线、形状重叠、覆盖率和越界
- QA 阈值和几何风险告警支持 VS Code 配置项调整
- QA 规则支持 `custom`、`balanced`、`strict`、`quiet` 预设
- QA 结构类告警支持独立开关，可关闭形状密度、连接线比例、未标注形状和页面覆盖率噪声
- QA 配置模板输出当前有效配置和 `delivery-review`、`inventory-quiet`、`layout-forensics` 团队 profile
- QA profile 带有 `namespace`，模板报告会按 namespace/profile 展示，便于共享 profile 分组管理
- QA profile 策略模板输出 `.aifde/reports/qa-profile-strategy-template.json` 和 `.md`，沉淀 `delivery-readiness`、`inventory-baseline` 和 `layout-triage` 命名策略
- QA profile 策略会展示 profile 应用顺序、适用场景、策略 rationale 和合并后的有效设置，便于团队共享批量应用策略
- QA 配置导出会生成 `.aifde/reports/qa-config-export.json` 和 `.md`，用于跨工作区共享当前有效配置
- QA 配置导入支持读取导出的 `settings`、模板里的 `currentEffectiveConfig`、共享 `profiles` 或直接配置键值，并只写入已知且类型合法的配置项
- QA 配置差异报告会读取一个配置 JSON，与当前有效配置逐项对比，并生成 `.aifde/reports/qa-config-diff.json` 和 `.md`
- 当 JSON 包含多个候选来源时，导入和差异报告会通过 QuickPick 选择具体 `settings`、`currentEffectiveConfig` 或 `profile:<name>`
- QA profile 可通过命令面板选择并写入工作区设置
- QA profile stack 支持一次选择多个团队 profile 并合并应用，后选 profile 会覆盖先选 profile 的同名设置
- QA profile strategy 支持选择命名策略并按预设顺序应用 profile stack，同时写入审计记录
- QA profile 应用会写入 `.aifde/reports/qa-profile-audit.json`，记录应用时间、profile 名称、写入设置和应用前有效配置
- QA 配置导入也会写入 `.aifde/reports/qa-profile-audit.json`，以 `import:<文件名>` 记录来源
- QA 配置回滚可从审计记录选择一次导入或 profile 应用，并恢复到该条目前的有效配置，同时追加 `rollback:<来源>` 审计记录
- QA profile 审计报告会读取 `.aifde/reports/qa-profile-audit.json` 并生成 `.aifde/reports/qa-profile-audit.md`，按时间倒序展示应用历史
- 使用当前页有效且 ID 唯一的 `Connects` 端点降低连接线穿节点误报，重复 Shape ID 端点会被降级为歧义证据
- 一键验收脚本覆盖 manifest、QA fixture、复杂路由 corpus、业务流程正向 corpus、本地几何坐标 corpus、旋转/翻转本地坐标 corpus、容器边界 corpus、端点连接线证据 corpus、嵌套分组 corpus、父/子 group 混合 Connects corpus、分组内本地几何路由 corpus、旋转父 group 本地几何路由 corpus、翻转父 group 本地几何路由 corpus、多层 group 组合变换 corpus、跨页重复 Shape ID 连接隔离 corpus、同页重复 Shape ID 连接证据降级 corpus、重复连接线 ID 连接证据降级 corpus、无效/跨页 Connects 过滤 corpus、单页/多页 Visio COM、打包、Demo Pack 生成、`demo:pack:check`、安装、扩展版本确认，以及成功后 Demo Pack 刷新和 strict 门禁

## 主要产物

- `ai-fde-vsdx-radar-<version>.vsix`
- `.aifde/previews/*.png`
- `.aifde/qa/*.qa.json`
- `.aifde/qa/*.qa.md`
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
- `.aifde/reports/workspace-vsdx-report.json`
- `.aifde/reports/workspace-vsdx-report.md`
- `.aifde/reports/workspace-vsdx-risk-report.json`
- `.aifde/reports/workspace-vsdx-risk-report.md`
- `.aifde/reports/workspace-vsdx-due-risk-report.json`
- `.aifde/reports/workspace-vsdx-due-risk-report.md`
- `.aifde/reports/workspace-vsdx-due-risk-calendar.ics`
- `.aifde/reports/workspace-vsdx-team-board.json`
- `.aifde/reports/workspace-vsdx-team-board.md`
- `.aifde/reports/demo-pack.json`
- `.aifde/reports/demo-pack.md`
- `.aifde/reports/qa-config-template.json`
- `.aifde/reports/qa-config-template.md`
- `.aifde/reports/qa-profile-strategy-template.json`
- `.aifde/reports/qa-profile-strategy-template.md`
- `.aifde/reports/qa-config-export.json`
- `.aifde/reports/qa-config-export.md`
- `.aifde/reports/qa-config-diff.json`
- `.aifde/reports/qa-config-diff.md`
- `.aifde/reports/qa-profile-audit.json`
- `.aifde/reports/qa-profile-audit.md`
- `.aifde/reports/workspace-vsdx-notes.json`
- `.aifde/cache-index.json`
- `.aifde/acceptance/acceptance-*.json`
- `.aifde/acceptance/acceptance-*.md`

## 验收命令

```bash +code
npm run acceptance
```

验收通过时应满足：

- `check manifest contributions` 退出码为 `0`
- `npm run verify` 退出码为 `0`
- `npm run package` 退出码为 `0`
- `install VSIX` 退出码为 `0`
- `check installed extension` 退出码为 `0`
- 当前 VS Code 扩展列表包含 `<publisher>.ai-fde-vsdx-radar@<version>`

## 演示入口

- 演示脚本：`docs/demo-script.md`
- QA 规则说明：`docs/qa-rules.md`
- UI 手测清单：`docs/ui-smoke.md`
- 验收说明：`docs/acceptance.md`

## 已知边界

- 高保真预览导出依赖本机 Microsoft Visio 和可用授权
- QA 几何规则仍是启发式判断，不替代人工版式评审
- 当前未接入远程 CI，验收链路以本机 Visio COM 为准
- 状态徽章依赖 VS Code 文件装饰刷新节奏，必要时可重载窗口

## 后续路线

1. 继续补充更多真实业务 `.vsdx` 样例，扩大 QA 规则覆盖面。
2. 继续补充更多真实图纸中的复杂路由样例，扩展跨页引用、容器和分组等边界场景。
