# Support

Use GitHub Issues for bug reports and feature requests:

```bash +code
https://github.com/ueacdyy-sys/ai-fde-vsdx-radar/issues
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
