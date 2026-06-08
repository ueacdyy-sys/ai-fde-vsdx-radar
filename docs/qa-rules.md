# AI-FDE VSDX Radar QA Rules

本文档解释 AI-FDE VSDX Radar 当前版本的 QA 规则、触发条件、相关配置和常见处理方式。QA 结果来自 `.vsdx` 包内 `visio/pages/page*.xml`、`visio/pages/pages.xml`、页面关系文件，以及 `.aifde/cache-index.json` 中记录的预览缓存信息。嵌套 group 子形状会递归展开，并将局部坐标转换到页面坐标后参与 QA。预览缓存失效时，QA JSON 会通过 `previewFreshnessReasons` 记录具体诊断原因。

## 严重级别

| 级别 | 含义 | 建议处理 |
| ---- | ---- | -------- |
| `Error` | 会影响预览证据完整性、页面可解析性或页面边界正确性 | 交付前优先修复 |
| `Warning` | 可能影响可读性、结构完整性或评审效率 | 结合图纸上下文复核 |

## 规则预设

`aiFdeVsdxRadar.qaPreset` 用来快速切换规则灵敏度。选择 `custom` 时，插件使用 VS Code 设置中的独立阈值和开关；选择其他预设时，会覆盖对应阈值和告警开关。

| 预设 | 形状密度阈值 | 连接线比例阈值 | 覆盖率低阈值 | 覆盖率高阈值 | 斜线连接 | 连接线穿节点 | 悬空连接线 | 形状重叠 |
| ---- | ------------ | -------------- | ------------ | ------------ | -------- | ------------ | ------------ | -------- |
| `custom` | 使用配置项 | 使用配置项 | 使用配置项 | 使用配置项 | 使用配置项 | 使用配置项 | 使用配置项 | 使用配置项 |
| `balanced` | `80` | `0.25` | `0.02` | `0.85` | 开启 | 开启 | 开启 | 开启 |
| `strict` | `60` | `0.35` | `0.04` | `0.75` | 开启 | 开启 | 开启 | 开启 |
| `quiet` | `120` | `0.1` | `0.005` | `0.95` | 关闭 | 开启 | 开启 | 关闭 |

除表中阈值和几何开关外，`balanced`、`strict`、`quiet` 会保持形状密度、连接线比例、未标注形状和页面覆盖率告警开启；需要单独关闭这些结构类告警时使用 `custom`。

## 规则总览

| 规则码 | 级别 | 触发条件 | 相关配置 |
| ------ | ---- | -------- | -------- |
| `PREVIEW_MISSING` | Error | 未记录预览路径，或记录的任一预览文件不存在 | `previewFormat`、`outputDirectory` |
| `PREVIEW_STALE` | Warning | 预览文件存在，但缓存记录中的 mtime、size、SHA-256 hash、PNG/PDF 完整性或常见 PNG 像素非空证据不足以证明它匹配当前源文件；具体原因写入 `previewFreshnessReasons` | `outputDirectory` |
| `VSDX_PARSE_FAILED` | Error | 读取 `.vsdx` zip 或解析页面 XML 时抛出异常 | 无 |
| `NO_PAGES` | Error | 未找到任何 `visio/pages/page*.xml` 页面条目 | 无 |
| `PAGE_EMPTY` | Error | 单个页面没有任何形状 | 无 |
| `PAGE_SIZE_UNKNOWN` | Warning | 无法从 `pages.xml` 读取页面宽度或高度 | 无 |
| `PAGE_SIZE_INVALID` | Error | 已读取页面宽高，但数值小于 `1` | 无 |
| `DUPLICATE_SHAPE_IDS` | Warning | 同一页递归展开后的形状存在重复 Shape ID | 无 |
| `NO_CONNECTORS` | Warning | 页面形状数大于 `5`，且没有 `OneD` 形状、端点连接线形状或 `Connects` 证据 | 无 |
| `CONNECTOR_RATIO_LOW` | Warning | 页面形状数至少 `6`，且 `Connects / Shapes` 低于阈值 | `connectorRatioWarningThreshold`、`enableConnectorRatioWarning`、`qaPreset` |
| `SHAPE_DENSITY_HIGH` | Warning | 单页形状数量高于阈值 | `shapeDensityWarningThreshold`、`enableShapeDensityWarning`、`qaPreset` |
| `UNLABELED_SHAPES` | Warning | 非连接线形状缺少可见文字 | `enableUnlabeledShapeWarning`、`qaPreset` |
| `SHAPE_OUT_OF_BOUNDS` | Error | 非连接线形状的边界超出页面范围 | 无 |
| `MULTIPAGE_PREVIEW_INCOMPLETE` | Warning | `.vsdx` 有多页，但缓存记录的预览页数少于页面数 | `previewFormat`、`outputDirectory` |
| `DIAGONAL_CONNECTORS` | Warning | 检测到起点和终点同时存在 X/Y 偏移的连接线 | `enableDiagonalConnectorWarning`、`qaPreset` |
| `CONNECTOR_CROSSES_SHAPE` | Warning | 连接线段疑似穿过非连接线形状 | `enableConnectorCrossingWarning`、`qaPreset` |
| `DANGLING_CONNECTORS` | Warning | 连接线形状缺少当前页有效 `Connects` 连接关系证据 | `enableDanglingConnectorWarning`、`qaPreset` |
| `SHAPE_OVERLAP` | Warning | 非连接线形状之间存在有意义重叠 | `enableShapeOverlapWarning`、`qaPreset` |
| `PAGE_COVERAGE_LOW` | Warning | 非连接线形状覆盖页面比例低于阈值 | `pageCoverageLowWarningThreshold`、`enablePageCoverageWarning`、`qaPreset` |
| `PAGE_COVERAGE_HIGH` | Warning | 非连接线形状覆盖页面比例高于阈值 | `pageCoverageHighWarningThreshold`、`enablePageCoverageWarning`、`qaPreset` |

## 缓存与解析规则

### `PREVIEW_MISSING`

- 级别：`Error`
- 判断方式：QA 运行时没有可用预览路径，或缓存记录中的任一预览文件已不存在。
- 常见原因：未执行预览导出、`.aifde/previews` 被清理、多页 PNG 中缺失 `page-2/page-3` 等后续页面。
- 处理建议：对该 `.vsdx` 执行 `AI-FDE: Export Preview and QA`，重新生成预览和 QA 证据。

### `PREVIEW_STALE`

- 级别：`Warning`
- 判断方式：预览文件存在，但缓存记录无法证明它是当前源文件对应的预览。插件会同时校验源文件 mtime、size、SHA-256 hash、预览文件 mtime/size、全部记录到的多页预览路径、PNG 签名/`IHDR` 宽高或 PDF 文件头；常见非交错 8-bit PNG 还会解压 `IDAT` 并检查是否存在非白/非透明像素。
- 诊断证据：QA JSON 的 `previewFreshnessReasons` 会列出具体失效原因，例如 `source hash changed`、`preview file missing`、`PNG file is too small` 或 `blank PNG image data`；Markdown 摘要、状态 tooltip、`Show VSDX Status` 输出、工作区报告的 `Status detail`、Dashboard 的 `Status detail` 列和 Dashboard/工作区报告里的 `Preview Freshness Summary` 也会输出同一组原因，Dashboard 还可按聚合后的原因筛选明细。
- 常见原因：源 `.vsdx` 修改后没有重新导出，旧缓存记录缺少 `sourceHash`，预览 PNG/PDF 文件损坏，预览 PNG 可解析但内容全白或透明，或 `.aifde/cache-index.json` 与预览文件不一致。
- 处理建议：重新执行导出；如果是批量交付，建议随后生成工作区风险报告确认没有剩余 `S` 或 `Q` 状态。

### `VSDX_PARSE_FAILED`

- 级别：`Error`
- 判断方式：读取 `.vsdx` 文件、加载 zip 包或解析 XML 时出现异常。
- 常见原因：文件损坏、扩展名为 `.vsdx` 但内容不是有效 Visio 包、页面 XML 结构异常。
- 处理建议：先用 Visio 打开并另存为新的 `.vsdx`；如仍失败，将该文件作为解析兼容性样例补充到后续测试集中。

### `NO_PAGES`

- 级别：`Error`
- 判断方式：包内没有匹配 `visio/pages/page*.xml` 的页面条目。
- 常见原因：文件不是标准 Visio 文档、文件损坏、页面内容被异常移除。
- 处理建议：用 Visio 重新保存文件，或确认输入文件类型是否正确。

### `MULTIPAGE_PREVIEW_INCOMPLETE`

- 级别：`Warning`
- 判断方式：解析到的页面数大于 `1`，但缓存记录的导出页数少于页面数。
- 常见原因：旧版本缓存只导出第一页、多页 PNG 后续文件被删除、导出过程被中断。
- 处理建议：重新执行 `AI-FDE: Export VSDX Preview` 或 `AI-FDE: Export Preview and QA`，然后用 `Open All VSDX Previews` 检查全部页面。

## 页面结构规则

### `PAGE_EMPTY`

- 级别：`Error`
- 判断方式：页面 XML 中没有任何 `Shape`。
- 常见原因：空白页、导出模板残留页面、页面内容被移动到其他页。
- 处理建议：删除无效页面，或补充实际图纸内容。

### `PAGE_SIZE_UNKNOWN`

- 级别：`Warning`
- 判断方式：无法从 `visio/pages/pages.xml` 读取页面宽度或高度。
- 常见原因：`pages.xml` 缺失、页面关系文件缺失、页面尺寸单元格不完整。
- 处理建议：用 Visio 重新设置页面尺寸并保存；若图纸可正常显示，可作为兼容性问题继续跟踪。

### `PAGE_SIZE_INVALID`

- 级别：`Error`
- 判断方式：页面宽度或高度被读取到，但数值小于 `1`。
- 常见原因：页面尺寸异常、文件结构损坏。
- 处理建议：在 Visio 中重新设置页面大小，保存后重新运行 QA。

### `UNLABELED_SHAPES`

- 级别：`Warning`
- 判断方式：非连接线形状没有可见文本。只包含空白字符的文本也视为无标签。
- 相关开关：`enableUnlabeledShapeWarning`。
- 常见原因：节点未命名、图形只靠颜色或位置表达语义。
- 处理建议：为业务节点、模块、系统边界和关键流程节点补充文字标签。

### `DUPLICATE_SHAPE_IDS`

- 级别：`Warning`
- 判断方式：页面形状递归展开后，存在两个或更多形状使用同一个 `Shape ID`。统计字段为 `duplicateShapeIdCount`，表示重复出现次数；相关 `Connects` 端点会被视为歧义证据，不参与合法连接端点跳过。
- 常见原因：异常复制、外部生成器写入了非唯一 ID，或 group 子形状与同页其他形状发生 ID 冲突。
- 测试证据：`test:qa` 会生成 `test/fixtures/duplicate-shape-id-same-page-group-corpus.vsdx` 和 `test/fixtures/duplicate-connector-id-same-page-corpus.vsdx`，验证同页 group 内重复 Shape ID 会触发 `DUPLICATE_SHAPE_IDS`，重复 ID 端点不会抵消 `CONNECTOR_CROSSES_SHAPE`，重复连接线 ID 也会作为歧义连接证据处理。
- 处理建议：用 Visio 重新保存或重建冲突形状，确保同一页每个形状 ID 唯一；若文件由生成器输出，应修正生成器的 ID 分配逻辑。

## 连接关系规则

### `NO_CONNECTORS`

- 级别：`Warning`
- 判断方式：页面形状数大于 `5`，同时没有 `OneD` 形状、没有具备 `BeginX/BeginY/EndX/EndY` 的端点连接线形状，也没有 `Connects` 连接证据。
- 常见原因：使用普通线条或截图表达关系，节点之间缺少 Visio 可解析的连接结构。
- 测试证据：`test:qa` 会生成 `test/fixtures/endpoint-connector-evidence-corpus.vsdx`，验证端点连接线可作为连接线证据，因此不会触发 `NO_CONNECTORS`。
- 处理建议：使用标准连接线重建关键关系，确保审查时能看出节点之间的方向和依赖。

### `CONNECTOR_RATIO_LOW`

- 级别：`Warning`
- 判断方式：页面形状数至少 `6`，且 `Connects / Shapes` 小于 `connectorRatioWarningThreshold`。
- 相关开关：`enableConnectorRatioWarning`。
- 常见原因：节点很多但关系表达不足，或连接线没有吸附到节点。
- 处理建议：补齐关键连接线，检查连接线端点是否真正连接到节点；团队可用 `strict` 提高灵敏度。

### 连接线路由分类指标

- 输出位置：QA JSON 的 `stats`、`pages` 和 QA Markdown 摘要。
- 指标：`straightConnectorCount`、`orthogonalConnectorCount`、`complexConnectorCount`。
- 判断方式：插件会把 `OneD`、connector/连接线命名或同时具备 `BeginX/BeginY/EndX/EndY` 的形状识别为连接线，并优先读取可与端点对齐的 `Geometry` 行形成路由点；若 `Geometry` 使用 Visio 本地坐标，则用 `PinX/PinY/LocPinX/LocPinY` 转换为页面坐标，并应用 `Angle`、`FlipX`、`FlipY` 后再判断。
- 分类含义：单段连接计入直线连接；多段且全部水平或垂直、段数不超过 `3` 时计入正交折线连接；更多折点或包含斜向路由段时计入复杂路由连接。
- 测试证据：`test:qa` 会生成 `test/fixtures/connector-route-corpus.vsdx`、`test/fixtures/local-geometry-route-corpus.vsdx`、`test/fixtures/transformed-local-geometry-route-corpus.vsdx`、`test/fixtures/group-local-geometry-route-corpus.vsdx`、`test/fixtures/rotated-group-local-geometry-route-corpus.vsdx`、`test/fixtures/flipped-group-local-geometry-route-corpus.vsdx` 和 `test/fixtures/nested-transformed-group-local-geometry-route-corpus.vsdx`，验证多折点正交路由计入 complex connector，本地几何坐标、旋转/翻转本地几何坐标、分组内本地几何路由、旋转父 group 下的本地几何路由、翻转父 group 下的本地几何路由和多层 group 组合变换下的本地几何路由可还原为正交折线，且不触发 `DIAGONAL_CONNECTORS` 或 `CONNECTOR_CROSSES_SHAPE`。
- 使用建议：正交折线通常比斜线更适合工程图审查；复杂路由较多时，建议人工复核是否存在绕线过多、跨层级或阅读负担过高的问题。

### `DIAGONAL_CONNECTORS`

- 级别：`Warning`
- 判断方式：连接线路由中的任一实际线段同时存在 X/Y 偏移，被视为斜线段。正交折线即使起终点呈斜向，也不会仅因起终点位置被计入斜线。
- 常见原因：手工拖动直线连接、未使用正交路由。
- 处理建议：优先改为正交连接或调整布局，减少跨层级斜穿导致的阅读负担；若团队接受斜线表达，可在 `quiet` 或自定义配置中关闭。

### `CONNECTOR_CROSSES_SHAPE`

- 级别：`Warning`
- 判断方式：连接线路由中的任一实际线段与非连接线形状矩形边界相交。插件会利用当前页有效且 ID 唯一的 `Connects` 端点跳过合法连接端点，降低误报；重复 Shape ID 不会作为无歧义端点证据。
- 常见原因：连接线穿过节点、节点布局过密、路由没有绕行。
- 处理建议：移动节点或调整连接线路由，让连接线避开非目标节点。

### `DANGLING_CONNECTORS`

- 级别：`Warning`
- 判断方式：页面中存在可识别的连接线形状，但没有当前页有效 `Connects` 关系证明它连接到任一节点；`FromSheet` 和 `ToSheet` 都必须能在当前页解析到，且用于证明连接的端点 ID 不能是重复 Shape ID。
- 相关开关：`enableDanglingConnectorWarning`。
- 常见原因：连接线端点没有吸附到形状、复制粘贴后连接关系丢失，或使用普通线条伪装关系。
- 测试证据：`test:qa` 会生成 `test/fixtures/group-parent-child-connects-corpus.vsdx`、`test/fixtures/duplicate-shape-id-multipage-corpus.vsdx`、`test/fixtures/duplicate-connector-id-same-page-corpus.vsdx` 和 `test/fixtures/invalid-connects-multipage-corpus.vsdx`，验证父 group ID 与子 shape ID 混合连接证据仍按当前页有效 `Connects` 处理，不同页面重复 Shape ID 时 `Connects` 只按当前页面计算，重复连接线 ID 的 `FromSheet` 证据会被降级为歧义证据，且指向缺失 Shape ID 或其他页面 Shape ID 的连接证据不会抵消 `DANGLING_CONNECTORS`。
- 处理建议：重新吸附连接线端点到目标节点；如果是刻意的注释线，建议改用明确标注或在 `custom` 配置中关闭该告警。

## 几何布局规则

### `SHAPE_OUT_OF_BOUNDS`

- 级别：`Error`
- 判断方式：非连接线形状的矩形边界超出页面宽高范围。
- 常见原因：形状被拖到页面外、页面尺寸缩小后内容未重新排布。
- 处理建议：调整页面尺寸或把形状移回页面内，避免预览裁切和交付遗漏。

### `SHAPE_OVERLAP`

- 级别：`Warning`
- 判断方式：两个非连接线形状的重叠面积达到较小形状面积的 `5%` 或以上；如果一个形状完整包含另一个形状，则视为容器、分组边界或泳道场景，不计入重叠对。
- 常见原因：节点堆叠、对齐不精确、复制粘贴后未分散；完整包含场景通常来自容器、泳道或分组边界。
- 处理建议：分离重叠节点；如果是刻意组合，建议使用容器、分组或清晰边界表达。

### `PAGE_COVERAGE_LOW`

- 级别：`Warning`
- 判断方式：非连接线形状裁剪到页面范围后的总面积占比低于 `pageCoverageLowWarningThreshold`。
- 相关开关：`enablePageCoverageWarning`。
- 常见原因：页面过大、内容过少、图形被放在页面角落。
- 处理建议：缩小页面、重新居中内容，或确认该页是否只是占位页。

### `PAGE_COVERAGE_HIGH`

- 级别：`Warning`
- 判断方式：非连接线形状裁剪到页面范围后的总面积占比高于 `pageCoverageHighWarningThreshold`。
- 相关开关：`enablePageCoverageWarning`。
- 常见原因：页面过于拥挤、节点尺寸过大、图纸缺少分层拆页。
- 处理建议：拆分页面、扩大页面尺寸或减少单页节点密度。

## 调参建议

- 日常交付建议使用 `balanced`，保持当前默认规则强度。
- 设计评审、架构评审和交付前复核建议使用 `strict`，更早暴露低连接率、页面过稀或过密问题。
- 历史图纸批量盘点建议使用 `quiet`，减少斜线连接和形状重叠噪声，先聚焦解析错误、缺预览、越界和连接线穿节点。
- 若某类业务图天然节点密集，可保留 `custom`，只提高 `shapeDensityWarningThreshold` 或 `pageCoverageHighWarningThreshold`。
- 若历史图纸缺少标签、页面过稀或连接线比例天然偏低，可在 `custom` 下关闭 `enableUnlabeledShapeWarning`、`enablePageCoverageWarning` 或 `enableConnectorRatioWarning`，先保留结构统计用于盘点。
- 若某类图纸大量使用说明块或分组，建议谨慎关闭 `enableShapeOverlapWarning`，同时保留 `CONNECTOR_CROSSES_SHAPE` 检查。
