# AI-FDE VSDX Radar Acceptance

本页记录本地交付验收入口。它用于快速证明当前插件版本已经完成编译、QA fixture、真实 Visio COM 冒烟、VSIX 打包、本地安装和扩展版本确认。

## 一键验收

```bash +code
npm run acceptance
```

验收脚本会执行以下步骤：

- 记录 PowerShell、Node.js 和 npm 版本
- 检查 VS Code 命令贡献和资源管理器右键菜单贡献
- 检查 VS Code 配置项贡献
- 执行 `npm run verify`
- 通过真实 Visio COM 验证单页和 3 页 PNG 预览导出
- 执行 `npm run package`
- 执行 `npm run demo:pack:check`，检查 Demo Pack 的 PowerShell 7.6.2 证据、版本、当前 VSIX artifact、最新验收报告新鲜度、artifact 数量、预览 gallery 数量、storyboard、`previewFreshnessSummary` 字段和 Markdown 汇总区块
- 安装当前版本 VSIX
- 通过 VS Code CLI 确认 `<publisher>.ai-fde-vsdx-radar@<version>`
- 写入 `.aifde/acceptance/acceptance-*.json`
- 写入 `.aifde/acceptance/acceptance-*.md`
- 成功时再次刷新 Demo Pack，并执行 `npm run demo:pack:check:strict`，确保 `latestAcceptance` 指向当前验收报告

## 跳过安装

只验证和打包，不安装 VSIX：

```bash +code
pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File ./scripts/acceptance-check.ps1 -SkipInstall
```

## 验收通过标准

- `npm run verify` 退出码为 `0`
- `npm run package` 退出码为 `0`
- 关键命令均存在于 `contributes.commands`
- 关键命令均存在于 `contributes.menus["explorer/context"]`
- 关键配置均存在于 `contributes.configuration.properties`
- 多页 smoke 生成 3 个非空且尺寸可读的 PNG 输出
- 当前版本 VSIX 文件存在且非空
- `npm run demo:pack:check` 退出码为 `0`
- Demo Pack JSON 包含 PowerShell 7.6.2、当前版本、当前 VSIX artifact、latestAcceptance、artifactCount、previewGalleryCount、storyboard、`previewFreshnessSummary` 和 `previewFreshnessSummaryCount`
- Demo Pack Markdown 包含 PowerShell 7.6.2、当前版本、当前 VSIX artifact、`Acceptance Freshness`、`Preview Freshness Summary`、`Presenter Storyboard`、`Preview Gallery` 和 `Artifact Index`
- 发布前执行 `npm run demo:pack:check:strict` 时，最新 acceptance 必须匹配当前版本
- acceptance 成功后，报告中的 `postAcceptanceDemoPackRefreshed` 和 `strictDemoPackCheckAfterReport` 均为 `true`
- 未使用 `-SkipInstall` 时，VS Code CLI 能列出当前版本扩展
- 验收报告 `success` 字段为 `true`

## 严格 Demo Pack 门禁

完整 acceptance 通过后，可刷新 Demo Pack 并执行严格门禁：

```bash +code
npm run demo:pack
npm run demo:pack:check:strict
```
