# Support / 支持与反馈

这是一个由个人维护的 VS Code / Visio `.vsdx` 插件项目，主要面向科研工作者、研究生、工程研究人员和经常需要画科研图、流程图、架构图的人。欢迎大家踊跃提出问题、建议和需求；只要不是特别重的功能，我都会尽量评估和推进。

Use GitHub Issues for bug reports and feature requests:

```bash +code
https://github.com/ueacdyy-sys/ai-fde-vsdx-radar/issues
```

也可以通过邮件联系维护者：

```bash +code
ueacdyy@gmail.com
```

如果这个插件对你有帮助，也欢迎到 GitHub 仓库给一个 Star：

```bash +code
https://github.com/ueacdyy-sys/ai-fde-vsdx-radar
```

When reporting a problem, include:

- VS Code version.
- PowerShell version from `pwsh -NoLogo -NoProfile -Command "$PSVersionTable.PSVersion.ToString()"`.
- Whether Microsoft Visio is installed and licensed.
- The command you ran.
- The relevant `.aifde/qa/*.qa.json` or `.aifde/reports/*.json` file, with sensitive paths or diagram text removed if needed.

For publishing or publisher ownership changes, update `package.json` and rerun:

```bash +code
npm run marketplace:check
npm run acceptance
```
