# Versioning Policy

AI-FDE VSDX Radar uses semantic versioning:

```text
MAJOR.MINOR.PATCH
```

## Rules

- Increase `PATCH` for narrow fixes that do not change the product scope, such as a single rendering bug, one UI overlap fix, or one false-positive correction.
- Increase `MINOR` when the extension gains meaningful capability, such as broader Visio semantic rendering coverage, a new editor workflow, new QA rule families, or a package/open-chain behavior upgrade.
- Increase `MAJOR` only for breaking changes, removed commands, incompatible artifact formats, or behavior that requires users to change their workflow.
- Do not keep incrementing `0.1.x` indefinitely after the renderer/editor moves to a new capability level. Promote to the next minor line instead.
- Do not create a new public version for every tiny local experiment. Batch related fixes, run gates, then release one coherent version.

## Current Line

- `0.1.x`: initial preview, QA, package, and small renderer fixes.
- `0.2.x`: semantic VSDX preview/editing hardening, manual Visio-created file compatibility, GUI-gated release process, and stronger lint/test coverage.

## Release Gate Labels

- `code-gated`: `npm run lint`, `npm run test:editor`, `npm run test:qa`, and `npm run package` pass.
- `gui-gated`: normal VS Code user profile, installed package version matches `package.json`, Windows display scale is 200%, and full-screen GUI screenshots pass for both manual Visio-created and AI-created VSDX files.
- `release-ready`: both `code-gated` and `gui-gated` are true.

Do not describe a build as release-ready when only code gates passed.
