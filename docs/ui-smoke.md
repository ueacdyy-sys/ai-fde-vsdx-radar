# AI-FDE VSDX Radar UI Smoke Checklist

本清单用于 VS Code 内的人工冒烟验收，重点确认资源管理器右键菜单、状态徽章、预览打开、QA 报告和产物目录路径。

## 准备

```bash +code
npm run acceptance
npm run smoke:visio
code .
```

测试文件：

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

## 右键菜单

- [ ] 在 VS Code 中打开项目根目录
- [ ] 在资源管理器中右键 `.vsdx` 文件
- [ ] 菜单中存在 `AI-FDE: Export Preview and QA`
- [ ] 菜单中存在 `AI-FDE: Export VSDX Preview`
- [ ] 菜单中存在 `AI-FDE: Run VSDX QA`
- [ ] 菜单中存在 `AI-FDE: Open VSDX Preview`
- [ ] 菜单中存在 `AI-FDE: Open All VSDX Previews`
- [ ] 菜单中存在 `AI-FDE: Open VSDX QA Report`
- [ ] 菜单中存在 `AI-FDE: Show VSDX Status`
- [ ] 菜单中存在 `AI-FDE: Reveal VSDX Artifacts`
- [ ] 命令面板中存在 `AI-FDE: Generate Workspace VSDX Report`
- [ ] 命令面板中存在 `AI-FDE: Generate Workspace VSDX Risk Report`
- [ ] 命令面板中存在 `AI-FDE: Generate Workspace Due VSDX Risk Report`
- [ ] 命令面板中存在 `AI-FDE: Export Workspace Due VSDX Risk Calendar`
- [ ] 命令面板中存在 `AI-FDE: Show Workspace Due VSDX Risk Reminder`
- [ ] 命令面板中存在 `AI-FDE: Generate Workspace VSDX Team Review Board`
- [ ] 命令面板中存在 `AI-FDE: Generate VSDX Demo Pack`
- [ ] 命令面板中存在 `AI-FDE: Generate QA Config Template`
- [ ] 命令面板中存在 `AI-FDE: Generate QA Profile Strategy Template`
- [ ] 命令面板中存在 `AI-FDE: Export QA Config`
- [ ] 命令面板中存在 `AI-FDE: Import QA Config`
- [ ] 命令面板中存在 `AI-FDE: Generate QA Config Diff Report`
- [ ] 命令面板中存在 `AI-FDE: Roll Back QA Config`
- [ ] 命令面板中存在 `AI-FDE: Apply QA Config Profile`
- [ ] 命令面板中存在 `AI-FDE: Apply QA Config Profile Stack`
- [ ] 命令面板中存在 `AI-FDE: Apply QA Profile Strategy`
- [ ] 命令面板中存在 `AI-FDE: Open QA Profile Audit Report`
- [ ] 命令面板中存在 `AI-FDE: Open Workspace VSDX Risk Dashboard`
- [ ] 命令面板中存在 `AI-FDE: Open Highest Priority VSDX Risk`
- [ ] 命令面板中存在 `AI-FDE: Open Next Due VSDX Risk`
- [ ] 命令面板中存在 `AI-FDE: Open All VSDX Risk Reports`

## 主流程

- [ ] 对 `visio-com-smoke.vsdx` 执行 `AI-FDE: Export Preview and QA`
- [ ] 输出面板显示 `[preview:...]` 和 `[qa]`
- [ ] `.aifde/previews/visio-com-smoke.*.png` 存在、非空且可正常打开
- [ ] `.aifde/qa/visio-com-smoke.*.qa.json` 存在
- [ ] `.aifde/qa/visio-com-smoke.*.qa.md` 存在
- [ ] 对同一文件执行 `AI-FDE: Open VSDX Preview`
- [ ] VS Code 能打开第一页 PNG 预览
- [ ] 执行 `AI-FDE: Open All VSDX Previews`
- [ ] 单页文件打开一个预览，多页文件按页打开多个预览
- [ ] 对 `visio-com-multipage-smoke.vsdx` 执行 `AI-FDE: Open All VSDX Previews`
- [ ] VS Code 能打开 3 个 PNG 预览
- [ ] 执行 `AI-FDE: Open VSDX QA Report`
- [ ] VS Code 能打开 Markdown QA 摘要
- [ ] QA 摘要包含直线连接、正交折线连接和复杂路由连接统计
- [ ] `connector-route-corpus.vsdx` 的 QA 摘要中 `complex` 连接数为 `1`
- [ ] `connector-route-corpus.vsdx` 不出现 `DIAGONAL_CONNECTORS` 或 `CONNECTOR_CROSSES_SHAPE` 风险
- [ ] `business-process-corpus.vsdx` 的 QA 摘要中直线连接数为 `3` 且无风险
- [ ] `local-geometry-route-corpus.vsdx` 的 QA 摘要中正交折线连接数为 `1`，且不出现 `DIAGONAL_CONNECTORS`
- [ ] `transformed-local-geometry-route-corpus.vsdx` 的 QA 摘要中正交折线连接数为 `2`，且不出现 `DIAGONAL_CONNECTORS`
- [ ] `container-boundary-corpus.vsdx` 的 QA 摘要中形状重叠数为 `0`，且不出现 `SHAPE_OVERLAP`
- [ ] `endpoint-connector-evidence-corpus.vsdx` 的 QA 摘要不出现 `NO_CONNECTORS`，但出现 `DANGLING_CONNECTORS`
- [ ] `group-nested-corpus.vsdx` 的 QA 摘要中形状数为 `4`、直线连接数为 `1` 且无风险
- [ ] `group-parent-child-connects-corpus.vsdx` 的 QA 摘要中直线连接数为 `1`，且不出现 `DANGLING_CONNECTORS` 或 `CONNECTOR_CROSSES_SHAPE`
- [ ] `group-local-geometry-route-corpus.vsdx` 的 QA 摘要中正交折线连接数为 `1`，且不出现 `DIAGONAL_CONNECTORS`
- [ ] `rotated-group-local-geometry-route-corpus.vsdx` 的 QA 摘要中正交折线连接数为 `1`，且不出现 `DIAGONAL_CONNECTORS`
- [ ] `flipped-group-local-geometry-route-corpus.vsdx` 的 QA 摘要中正交折线连接数为 `1`，且不出现 `DIAGONAL_CONNECTORS`
- [ ] `nested-transformed-group-local-geometry-route-corpus.vsdx` 的 QA 摘要中正交折线连接数为 `1`，且不出现 `DIAGONAL_CONNECTORS`
- [ ] `duplicate-shape-id-multipage-corpus.vsdx` 的 QA 摘要中第一页悬空连接数为 `0`、第二页悬空连接数为 `1`
- [ ] `duplicate-shape-id-same-page-group-corpus.vsdx` 的 QA 摘要中 `duplicateIds` 为 `1`、`crossings` 为 `1`，且出现 `DUPLICATE_SHAPE_IDS` 和 `CONNECTOR_CROSSES_SHAPE`
- [ ] `duplicate-connector-id-same-page-corpus.vsdx` 的 QA 摘要中 `connects` 为 `2`、`duplicateIds` 为 `1`、`dangling` 为 `2`，且只出现 `DUPLICATE_SHAPE_IDS` 和 `DANGLING_CONNECTORS`
- [ ] `invalid-connects-multipage-corpus.vsdx` 的 QA 摘要中第二页保留原始 `connectCount=2`，但悬空连接数仍为 `1`
- [ ] 执行 `AI-FDE: Reveal VSDX Artifacts`
- [ ] 系统文件管理器打开 `.aifde` 产物目录
- [ ] 从命令面板执行 `AI-FDE: Generate Workspace VSDX Report`
- [ ] VS Code 能打开 `.aifde/reports/workspace-vsdx-report.md`
- [ ] `.aifde/reports/workspace-vsdx-report.json` 存在
- [ ] Markdown 报告包含 `Owner Summary`、`Attention Needed` 和 `All Files` 区块
- [ ] `Owner Summary` 能显示负责人、风险数、逾期数、7 天内到期数和处理状态计数
- [ ] 从命令面板执行 `AI-FDE: Generate Workspace VSDX Risk Report`
- [ ] VS Code 能打开 `.aifde/reports/workspace-vsdx-risk-report.md`
- [ ] 风险报告只包含非 `OK` 文件
- [ ] 从命令面板执行 `AI-FDE: Generate Workspace Due VSDX Risk Report`
- [ ] VS Code 能打开 `.aifde/reports/workspace-vsdx-due-risk-report.md`
- [ ] 到期风险报告只包含逾期或 7 天内到期的非 `OK` 文件
- [ ] 从命令面板执行 `AI-FDE: Export Workspace Due VSDX Risk Calendar`
- [ ] VS Code 能打开 `.aifde/reports/workspace-vsdx-due-risk-calendar.ics`
- [ ] ICS 文件包含 `BEGIN:VCALENDAR`，并为设置了到期日的非 `OK` 文件生成 `VEVENT`
- [ ] 从命令面板执行 `AI-FDE: Show Workspace Due VSDX Risk Reminder`
- [ ] 提醒弹窗显示逾期数量和 7 天内到期数量
- [ ] 提醒弹窗提供 `Open Dashboard`、`Generate Due Report` 和 `Open Next Due Risk` 动作
- [ ] 从命令面板执行 `AI-FDE: Generate Workspace VSDX Team Review Board`
- [ ] VS Code 能打开 `.aifde/reports/workspace-vsdx-team-board.md`
- [ ] `.aifde/reports/workspace-vsdx-team-board.json` 存在
- [ ] 团队评审看板包含 `Board Summary`、`Owner Workload` 和 New/Reviewing/Accepted/Resolved 风险泳道
- [ ] 从命令面板执行 `AI-FDE: Generate VSDX Demo Pack`
- [ ] VS Code 能打开 `.aifde/reports/demo-pack.md`
- [ ] `.aifde/reports/demo-pack.json` 存在
- [ ] Demo Pack JSON 包含 `previewFreshnessSummary` 和 `previewFreshnessSummaryCount`
- [ ] Demo Pack JSON 包含 `latestAcceptance.status` 和 `latestAcceptance.matchesCurrentVersion`
- [ ] Demo Pack 包含 `Acceptance Freshness`、`Preview Freshness Summary`、`Presenter Storyboard`、`Preview Gallery` 和 `Artifact Index`
- [ ] 执行 `npm run demo:pack` 后同一份 `.aifde/reports/demo-pack.md` 能刷新
- [ ] 执行 `npm run demo:pack:check` 后输出 `success=true`，并包含 `powerShellVersion` 为 `7.6.2`、`latestAcceptanceStatus`、`artifactCount`、`previewGalleryCount` 和 `storyboardCount`
- [ ] 完整 acceptance 已匹配当前版本后，执行 `npm run demo:pack:check:strict` 输出 `success=true`
- [ ] `npm run acceptance` 成功后，最新 Demo Pack 的 `latestAcceptance.matchesCurrentVersion` 为 `true`
- [ ] 从命令面板执行 `AI-FDE: Generate QA Config Template`
- [ ] VS Code 能打开 `.aifde/reports/qa-config-template.md`
- [ ] QA 配置模板包含当前有效配置和团队 profile
- [ ] QA 配置模板的团队 profile 表包含 namespace 列
- [ ] 从命令面板执行 `AI-FDE: Generate QA Profile Strategy Template`
- [ ] VS Code 能打开 `.aifde/reports/qa-profile-strategy-template.md`
- [ ] `.aifde/reports/qa-profile-strategy-template.json` 存在
- [ ] QA profile 策略模板包含 `delivery-readiness`、`inventory-baseline` 和 `layout-triage`
- [ ] QA profile 策略模板展示 profile 顺序、适用场景和合并后的有效设置
- [ ] 从命令面板执行 `AI-FDE: Export QA Config`
- [ ] VS Code 能打开 `.aifde/reports/qa-config-export.md`
- [ ] `.aifde/reports/qa-config-export.json` 存在且包含 `settings`
- [ ] 从命令面板执行 `AI-FDE: Generate QA Config Diff Report`
- [ ] 选择 `.aifde/reports/qa-config-export.json` 后 VS Code 能打开 `.aifde/reports/qa-config-diff.md`
- [ ] `.aifde/reports/qa-config-diff.json` 存在且包含 changed、missing-in-source 和 same 统计
- [ ] 选择 `.aifde/reports/qa-config-template.json` 时 QuickPick 能显示 `currentEffectiveConfig` 和 `profile:<name>` 候选
- [ ] 从命令面板执行 `AI-FDE: Import QA Config`
- [ ] 选择 `.aifde/reports/qa-config-export.json` 后工作区设置成功写入
- [ ] 选择 `.aifde/reports/qa-config-template.json` 时 QuickPick 能选择具体团队 profile
- [ ] `.aifde/reports/qa-profile-audit.json` 存在且包含 `import:qa-config-export.json`
- [ ] 从命令面板执行 `AI-FDE: Roll Back QA Config`
- [ ] QuickPick 中能看到刚才的 `import:qa-config-export.json` 审计条目
- [ ] 选择该条目后工作区设置恢复到导入前状态
- [ ] `.aifde/reports/qa-profile-audit.json` 存在且包含 `rollback:import:qa-config-export.json`
- [ ] 从命令面板执行 `AI-FDE: Apply QA Config Profile`
- [ ] QuickPick 中存在 `delivery-review`、`inventory-quiet` 和 `layout-forensics`
- [ ] 选择 profile 后工作区设置中写入对应 QA 配置
- [ ] 从命令面板执行 `AI-FDE: Apply QA Config Profile Stack`
- [ ] QuickPick 支持选择多个 namespace/profile
- [ ] 选择多个 profile 后工作区设置写入合并后的 QA 配置
- [ ] `.aifde/reports/qa-profile-audit.json` 存在且包含刚才应用的 profile 名称
- [ ] 从命令面板执行 `AI-FDE: Apply QA Profile Strategy`
- [ ] QuickPick 中存在 `delivery-readiness`、`inventory-baseline` 和 `layout-triage`
- [ ] 选择策略后工作区设置写入策略合并后的 QA 配置
- [ ] `.aifde/reports/qa-profile-audit.json` 存在且包含 `strategy:<namespace>/<strategy>`
- [ ] 从命令面板执行 `AI-FDE: Open QA Profile Audit Report`
- [ ] VS Code 能打开 `.aifde/reports/qa-profile-audit.md`
- [ ] 审计报告包含刚才应用的 profile 名称、写入设置和应用前有效配置
- [ ] 从命令面板执行 `AI-FDE: Open Workspace VSDX Risk Dashboard`
- [ ] Dashboard 能显示工作区 `.vsdx` 状态统计
- [ ] Dashboard 顶部显示 `Preview Freshness Summary`
- [ ] Dashboard 支持按状态、风险码、缓存失效原因、处理状态、负责人和关键词过滤
- [ ] 点击 `Preview Freshness Summary` 中某个原因后，明细列表只显示匹配该原因的条目
- [ ] 点击 `Reset filters` 后，搜索、状态、风险码、缓存失效原因、处理状态、负责人和 `Only risks` 恢复默认
- [ ] Dashboard 显示 `Status detail` 列，缓存过期时可直接查看预览失效原因
- [ ] Dashboard 支持按风险优先级、到期时间、负责人、处理状态和文件名排序
- [ ] Dashboard 支持按状态、处理状态、负责人、到期状态和风险码分组
- [ ] Dashboard 顶部显示负责人数量、逾期数量和 7 天内到期数量
- [ ] Dashboard 显示负责人汇总表
- [ ] 点击负责人汇总表中的负责人后，明细列表只显示该负责人条目
- [ ] Dashboard 能修改单个 `.vsdx` 的处理状态
- [ ] Dashboard 能修改单个 `.vsdx` 的负责人
- [ ] Dashboard 能修改单个 `.vsdx` 的到期时间
- [ ] Dashboard 能填写整改备注并显示 `Saved`
- [ ] Dashboard 能选择可见行并批量设置处理状态、负责人、到期时间和整改备注
- [ ] `.aifde/reports/workspace-vsdx-notes.json` 存在且包含刚才保存的备注
- [ ] Dashboard 中的 `Source`、`QA` 和 `Preview` 按钮能打开对应文件
- [ ] 从命令面板执行 `AI-FDE: Open Highest Priority VSDX Risk`
- [ ] VS Code 打开最高优先级风险的 QA 摘要或源 `.vsdx`
- [ ] 从命令面板执行 `AI-FDE: Open Next Due VSDX Risk`
- [ ] VS Code 打开逾期或最早到期风险的 QA 摘要或源 `.vsdx`
- [ ] 从命令面板执行 `AI-FDE: Open All VSDX Risk Reports`
- [ ] VS Code 打开所有非 `OK` 文件的 QA 摘要或源 `.vsdx`

## 状态徽章

- [ ] 缺少预览缓存时显示 `M`
- [ ] 预览过期时显示 `S`
- [ ] QA 缺失或过期时显示 `Q`
- [ ] QA 有 error 时显示 `E`
- [ ] QA 有 warning 时显示 `R`
- [ ] 预览和 QA 都为当前状态且无风险时显示 `OK`

## 配置项

- [ ] VS Code 设置中存在 `aiFdeVsdxRadar.qaPreset`
- [ ] `qaPreset` 可选 `custom`、`balanced`、`strict`、`quiet`
- [ ] VS Code 设置中存在 `aiFdeVsdxRadar.enableShapeDensityWarning`
- [ ] VS Code 设置中存在 `aiFdeVsdxRadar.enableConnectorRatioWarning`
- [ ] VS Code 设置中存在 `aiFdeVsdxRadar.enableUnlabeledShapeWarning`
- [ ] VS Code 设置中存在 `aiFdeVsdxRadar.enablePageCoverageWarning`
- [ ] VS Code 设置中存在 `aiFdeVsdxRadar.enableDanglingConnectorWarning`
- [ ] `custom` 时单独阈值和告警开关生效

## 通过标准

- 所有右键命令可见
- 主流程命令无错误弹窗
- 输出面板路径可打开
- 预览、QA JSON、QA Markdown 均能生成
- `Reveal VSDX Artifacts` 能定位 `.aifde` 目录
- 状态徽章和 QA 风险数量符合当前文件状态
