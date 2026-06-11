# Security

AI-FDE VSDX Radar runs locally inside VS Code and writes workspace artifacts under `.aifde`.

## Reporting

Please report security issues privately to the repository owner at `ueacdyy@gmail.com` before opening a public issue. If this project is moved to another GitHub organization, update this file with the preferred private disclosure address.

## Local Execution Notes

- Preview export invokes PowerShell 7.6.2 and Microsoft Visio COM automation on Windows.
- The extension reads `.vsdx` files from the active workspace and writes preview, QA, and report artifacts under `.aifde`.
- No cloud service is required for preview export or QA linting.
- Do not run the extension in workspaces that contain untrusted `.vsdx` files unless you are comfortable with local file parsing and local Visio automation.
