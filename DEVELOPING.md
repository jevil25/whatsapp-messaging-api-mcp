# Developing

This repo is public **on purpose**. It was split out of a private monorepo
because Smithery, glama.ai and mcp.so all key their listings off a GitHub
repository URL, and npm can only generate provenance attestations for builds
from a public repo. None of that was possible while the source lived in the
private repo.

Nothing here is secret. The server holds no credentials — the API key comes from
`WHATSAPP_API_KEY` at runtime and is sent only to the API host.

## Publishing to npm

`.github/workflows/publish.yml` publishes when the version in `package.json`
changes on `main`. No tags, no releases — bump, merge, it publishes. Leave the
version alone and it skips, so it is safe on every push.

It needs one repo secret: **`NPM_TOKEN`**, a granular access token with read and
write on `whatsapp-messaging-api-mcp`.

`prepublishOnly` runs build + smoke test, so publishing by hand gets the same
gate as CI.

### The version lives in four places

`package.json`, `src/index.ts`, and `server.json` twice — top level and
`packages[0].version`. The smoke test asserts all four agree and fails the
release if they do not. It exists because two version numbers were already
burned on this: 1.0.0 and 1.0.1 both shipped without the `mcpName` field, and
npm versions are immutable, so each mistake costs a version rather than a retry.

## Publishing to the MCP registry

The registry stores metadata only — it points at the npm package rather than
hosting it. **Order matters: npm first, registry second.** The registry fetches
`package.json` from registry.npmjs.org and checks `mcpName` matches the `name`
in `server.json`. Publish to the registry before npm has the version and
verification fails with a "missing required 'mcpName' field" error.

```bash
mcp-publisher validate    # checks server.json against the live schema
mcp-publisher login github
mcp-publisher publish
```

The namespace `io.github.jevil25/*` is granted by logging in as that GitHub
account. It cannot be changed without republishing under a different name.

## Other directories

Each is a separate submission — the official registry is an upstream data
source, not a substitute:

- **Smithery** — add `smithery.yaml` to the repo root, then `smithery mcp publish`
- **glama.ai** — "Add Server", keyed on `<github-user>/<repo>`
- **mcp.so** — form at mcp.so/submit; free tier is reviewed, $39 skips review and
  adds a dofollow link

## Testing

```bash
npm test
```

Boots the built server over stdio, drives a real MCP handshake, and asserts:

- all nine tools are present with usable descriptions and object schemas
- `mcpName` matches `server.json`'s `name`
- every version field agrees
- `server.json`'s description fits the registry's 100-character cap

It catches what compilation cannot — most importantly a zod/SDK version mismatch,
which breaks schema serialization at `tools/list` rather than at build time. The
SDK peer-deps `zod@^3.25 || ^4.0`.

## Things deliberately not done

- **No tarball-contents assertion in the smoke test.** npm force-includes the
  bin/main target, README and LICENSE whatever `files` says, so a check that
  `dist/index.js` ships passes even with `files: ["README.md"]` and can never
  fail. Don't add it back.
- **No version single-sourcing.** `src/index.ts` could import the version from
  `package.json`, but `server.json` would still need its own bump, so the check
  is doing the real work either way.
