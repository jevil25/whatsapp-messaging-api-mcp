#!/usr/bin/env node
// Pre-publish smoke test. Boots the built server over stdio and asserts it
// speaks MCP, then checks the tarball would actually contain the bin target.
//
// This gates the publish workflow because publishing is irreversible: npm's
// unpublish window is 72 hours and does not free the name. A broken build that
// reaches the registry is a permanently broken version number.
//
//   node smoke-test.mjs
//
// Needs no credentials — the dummy key gets far enough to list tools, since
// nothing here makes an API call.

import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const EXPECTED_TOOLS = [
  'list_sessions', 'create_session', 'get_session_status', 'get_qr_code',
  'request_pairing_code', 'check_contact_exists', 'send_text_message',
  'send_image', 'send_file',
]

function rpc(...messages) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['dist/index.js'], {
      env: { ...process.env, WHATSAPP_API_KEY: 'dummy-key-no-api-call-is-made' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    // Without this the test hangs forever on a server that starts but never
    // answers, which is exactly the failure it exists to catch.
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('server did not respond within 20s'))
    }, 20_000)

    let out = ''
    let err = ''
    child.stdout.on('data', (c) => (out += c))
    child.stderr.on('data', (c) => (err += c))
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0 && !out) return reject(new Error(`server exited ${code}: ${err.trim()}`))
      resolve({ out, err })
    })
    child.stdin.end(messages.map((m) => JSON.stringify(m)).join('\n') + '\n')
  })
}

const { out, err } = await rpc(
  {
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'smoke-test', version: '0' },
    },
  },
  { jsonrpc: '2.0', method: 'notifications/initialized' },
  { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }
)

const replies = new Map(
  out.trim().split('\n').filter(Boolean).map((l) => {
    const m = JSON.parse(l)
    return [m.id, m]
  })
)

const init = replies.get(1)
assert.ok(init, `no initialize response. stderr: ${err.trim()}`)
assert.ok(!init.error, `initialize failed: ${JSON.stringify(init.error)}`)
assert.equal(init.result.serverInfo.name, 'whatsapp-messaging-api')

const list = replies.get(2)
assert.ok(list, 'no tools/list response')
assert.ok(!list.error, `tools/list failed: ${JSON.stringify(list.error)}`)

// A zod-version mismatch between the MCP SDK and the installed zod surfaces
// here — schemas fail to serialize at tools/list, not at compile time.
const names = list.result.tools.map((t) => t.name).sort()
assert.deepEqual(names, [...EXPECTED_TOOLS].sort(), 'tool list changed unexpectedly')
for (const tool of list.result.tools) {
  assert.ok(tool.description?.length > 10, `${tool.name} is missing a usable description`)
  assert.equal(tool.inputSchema?.type, 'object', `${tool.name} has no object input schema`)
}

// The version is hardcoded in src/index.ts as well as package.json, so a
// release can bump the package and still announce the old version to every MCP
// client. Nothing else catches that — it is not a type error and the server
// runs fine.
//
// Deliberately NOT asserted here: that the tarball contains dist/index.js.
// npm force-includes the bin/main target, README and LICENSE whatever `files`
// says, so that check passes even with `files: ["README.md"]` and can never
// fail. Don't add it back.
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
assert.equal(
  init.result.serverInfo.version,
  pkg.version,
  `server reports v${init.result.serverInfo.version} but package.json says v${pkg.version} — ` +
    `bump the version in src/index.ts too`
)

// The registry proves npm ownership by fetching package.json from
// registry.npmjs.org and matching `mcpName` against server.json's `name`. A
// version published without mcpName cannot be registered, and npm versions are
// immutable — so getting this wrong costs a version number, not a retry. It
// already cost 1.0.0 and 1.0.1.
const srv = JSON.parse(readFileSync('server.json', 'utf8'))
assert.equal(pkg.mcpName, srv.name, 'package.json mcpName must equal server.json name')
assert.equal(srv.version, pkg.version, 'server.json version must match package.json')
assert.equal(
  srv.packages[0].version,
  pkg.version,
  'server.json packages[0].version must match package.json — it is a second copy and drifts silently'
)
assert.equal(srv.packages[0].identifier, pkg.name, 'server.json packages[0].identifier must be the npm package name')
assert.ok(srv.description.length <= 100, `server.json description is ${srv.description.length} chars, schema caps it at 100`)

console.log(
  `smoke test passed — ${names.length} tools, v${pkg.version}, mcpName ${pkg.mcpName}`
)
