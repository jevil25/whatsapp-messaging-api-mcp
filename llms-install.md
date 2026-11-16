# Installing the WhatsApp Messaging API MCP server

These steps are for an AI agent (such as Cline) setting up this server for a user.

1. Ask the user for an API key. They get one by signing in at https://whatsapp-messaging.retentionstack.agency/start (free tier, no card):
   - A session token (`ch_live_...`) works for one linked number. Tools then need no `session` argument.
   - An account key (`ak_live_...`) works for every number on the account and is required for `create_session`.
2. Add the server to the MCP settings file. No clone or build is needed; `npx` downloads the package:

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "npx",
      "args": ["-y", "whatsapp-messaging-api-mcp"],
      "env": {
        "WHATSAPP_API_KEY": "<the user's key>"
      }
    }
  }
}
```

3. Check the setup by calling `list_sessions`. An authentication error means the key is wrong or was copied with extra spaces.
4. If no session is `WORKING`, link the user's number: call `get_qr_code` and ask them to scan it in WhatsApp under **Settings → Linked devices**, or call `request_pairing_code` with their phone number. Then poll `get_session_status` until it reports `WORKING`.
5. If the status is `PASSKEY_REQUIRED`, tell the user to finish linking in the console at https://whatsapp-messaging.retentionstack.agency/app.

Requires Node.js 18 or newer.
