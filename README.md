# WhatsApp Messaging API — MCP Server

Send WhatsApp messages from Claude, Cursor, or any MCP client. Create a session, scan a QR code, and send text, images and files — **no Meta Business approval and no WhatsApp Business account required.**

Wraps the [WhatsApp Messaging API](https://rapidapi.com/jevil257/api/whatsapp-messaging-bot).

## Quick start

1. Get a free API key from [RapidAPI](https://rapidapi.com/jevil257/api/whatsapp-messaging-bot) — no credit card.
2. Add this to your MCP client config (Claude Desktop: `claude_desktop_config.json`):

   ```json
   {
     "mcpServers": {
       "whatsapp": {
         "command": "npx",
         "args": ["-y", "whatsapp-messaging-api-mcp"],
         "env": {
           "WHATSAPP_API_KEY": "your-rapidapi-key"
         }
       }
     }
   }
   ```

3. Restart the client. Ask it to create a WhatsApp session and show you the QR code.

Nothing to install or build — `npx` fetches the package on first run.

## Tools

| Tool | Description |
|---|---|
| `list_sessions` | List all sessions on this API key |
| `create_session` | Create a new session |
| `get_session_status` | Check a session's current status |
| `get_qr_code` | Get the QR code to authenticate a session |
| `request_pairing_code` | Get an 8-digit pairing code instead of a QR |
| `check_contact_exists` | Check if a phone number is on WhatsApp before sending |
| `send_text_message` | Send a text message |
| `send_image` | Send an image via URL |
| `send_file` | Send a file (PDF, document) via URL |

## Typical flow

1. `create_session` → `get_qr_code` → scan with WhatsApp (Settings → Linked Devices)
2. `get_session_status` until it reports `WORKING`
3. `check_contact_exists`, then `send_text_message` / `send_image` / `send_file`

Sessions stay authenticated between runs, so steps 1-2 are one-time per number.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `WHATSAPP_API_KEY` | yes | Your RapidAPI key. The server exits on startup if it is missing. |

The key is read from the environment and sent only to the API host. It is never logged.

## Local development

```bash
git clone https://github.com/jevil25/whatsapp-messaging-api-mcp.git
cd whatsapp-messaging-api-mcp
npm install
npm run dev      # runs src/index.ts directly via tsx, no build step
npm run build    # compile to dist/
npm test         # boots the built server and drives a real MCP handshake
```

`npm test` needs no credentials — it passes a dummy key, which gets far enough to
list tools because nothing in the handshake makes an API call.

To point an MCP client at your local build, use `"command": "node"` with
`"args": ["/absolute/path/to/dist/index.js"]`.

See [DEVELOPING.md](DEVELOPING.md) for the release process.

## Links

- [npm package](https://www.npmjs.com/package/whatsapp-messaging-api-mcp)
- [MCP registry entry](https://registry.modelcontextprotocol.io/v0/servers?search=whatsapp-messaging-api-mcp) — `io.github.jevil25/whatsapp-messaging-api-mcp`
- [WhatsApp Messaging API docs](https://whatsapp-messaging.retentionstack.agency/docs)

## License

MIT
