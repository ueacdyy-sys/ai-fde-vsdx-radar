# Marketplace Publishing Guide

This guide prepares AI-FDE VSDX Radar for a formal Visual Studio Marketplace release.

## Release Identity

The current proposed Marketplace identity is:

```bash +code
publisher: ai-fde-lab
extension: ai-fde-vsdx-radar
extension id: ai-fde-lab.ai-fde-vsdx-radar
```

Create the `ai-fde-lab` publisher in Visual Studio Marketplace before publishing, or change `publisher`, `repository`, `bugs`, and `homepage` in `package.json` to match the publisher and GitHub repository you create.

## Required Local Checks

Run all commands from the extension root:

```bash +code
npm install
npm run marketplace:assets
npm run marketplace:check
npm run acceptance
```

`acceptance` performs the end-to-end local gate: manifest checks, QA fixture tests, Visio single-page and multi-page smoke exports, QA evidence generation, VSIX packaging, Demo Pack checks, local VSIX install, and strict Demo Pack freshness validation.

## Publishing Options

Microsoft recommends identity-based automated publishing for long-term pipelines. A manual first release can still be done with `vsce`:

```bash +code
vsce login ai-fde-lab
vsce publish
```

Manual upload is also available from the Visual Studio Marketplace publisher management page after running:

```bash +code
npm run package
```

## Final Human Review

Before pressing publish:

- Confirm the publisher ID is final; changing it later creates a different extension ID.
- Confirm the repository URLs resolve.
- Confirm the license text matches the intended distribution model.
- Open the packaged VSIX locally and run `AI-FDE: Export Preview and QA` on a real `.vsdx`.
- Review `README.md`, `CHANGELOG.md`, and `images/marketplace-preview.png` as they appear in the extension details page.
