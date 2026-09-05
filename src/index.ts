#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_HOST = 'whatsapp-messaging-bot.p.rapidapi.com';
const BASE_URL = `https://${API_HOST}`;
const API_KEY = process.env.WHATSAPP_API_KEY;

if (!API_KEY) {
  console.error('Missing WHATSAPP_API_KEY environment variable. Get a free key at https://rapidapi.com/jevil257/api/whatsapp-messaging-bot');
  process.exit(1);
}

async function callApi(method: string, path: string, body?: unknown, query?: Record<string, string>) {
  const url = new URL(path, BASE_URL);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    method,
    headers: {
      'x-rapidapi-key': API_KEY!,
      'x-rapidapi-host': API_HOST,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function toolResult(result: { status: number; data: unknown }) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    isError: result.status >= 400,
  };
}

const server = new McpServer({
  name: 'whatsapp-messaging-api',
  version: '1.0.3',
});

server.registerTool(
  'list_sessions',
  {
    description: 'List all WhatsApp sessions belonging to this API key.',
    inputSchema: {},
  },
  async () => toolResult(await callApi('GET', '/v1/sessions'))
);

server.registerTool(
  'create_session',
  {
    description: 'Create a new WhatsApp session. Returns a session name and STARTING status — pair it with get_qr_code next.',
    inputSchema: {
      name: z.string().optional().describe('Optional session name. Auto-generated if omitted.'),
    },
  },
  async ({ name }) => toolResult(await callApi('POST', '/v1/sessions', name ? { name } : {}))
);

server.registerTool(
  'get_session_status',
  {
    description: 'Get the current status of a session (STARTING, SCAN_QR_CODE, WORKING, FAILED, STOPPED).',
    inputSchema: {
      session: z.string().describe('Session name'),
    },
  },
  async ({ session }) => toolResult(await callApi('GET', `/v1/sessions/${encodeURIComponent(session)}`))
);

server.registerTool(
  'get_qr_code',
  {
    description: 'Get the QR code to authenticate a session by scanning with WhatsApp (Settings > Linked Devices).',
    inputSchema: {
      session: z.string().describe('Session name'),
    },
  },
  async ({ session }) =>
    toolResult(await callApi('GET', `/v1/${encodeURIComponent(session)}/auth/qr`, undefined, { format: 'base64' }))
);

server.registerTool(
  'request_pairing_code',
  {
    description: 'Request an 8-digit pairing code as an alternative to scanning a QR code.',
    inputSchema: {
      session: z.string().describe('Session name'),
      phoneNumber: z.string().regex(/^\d{10,15}$/).describe('Phone number, 10-15 digits, no + or spaces'),
    },
  },
  async ({ session, phoneNumber }) =>
    toolResult(await callApi('POST', `/v1/${encodeURIComponent(session)}/auth/pairing-code`, { phoneNumber }))
);

server.registerTool(
  'check_contact_exists',
  {
    description: 'Check whether a phone number is registered on WhatsApp before sending to it.',
    inputSchema: {
      session: z.string().describe('Session name'),
      phone: z.string().regex(/^\d{10,15}$/).describe('Phone number, 10-15 digits, no + or spaces'),
    },
  },
  async ({ session, phone }) =>
    toolResult(await callApi('GET', '/v1/contacts/check-exists', undefined, { session, phone }))
);

server.registerTool(
  'send_text_message',
  {
    description: 'Send a WhatsApp text message to a contact, group, or channel.',
    inputSchema: {
      session: z.string().describe('Session name'),
      chatId: z.string().describe('Recipient: a phone number (e.g. "14155552671"), a group ID, or a channel ID'),
      text: z.string().describe('Message text'),
    },
  },
  async ({ session, chatId, text }) =>
    toolResult(await callApi('POST', '/v1/sendText', { session, chatId, text }))
);

server.registerTool(
  'send_image',
  {
    description: 'Send an image to a contact, group, or channel via a public URL.',
    inputSchema: {
      session: z.string().describe('Session name'),
      chatId: z.string().describe('Recipient: phone number, group ID, or channel ID'),
      imageUrl: z.string().url().describe('Public URL of the image'),
      caption: z.string().optional().describe('Optional caption'),
    },
  },
  async ({ session, chatId, imageUrl, caption }) =>
    toolResult(
      await callApi('POST', '/v1/sendImage', {
        session,
        chatId,
        file: { url: imageUrl },
        ...(caption ? { caption } : {}),
      })
    )
);

server.registerTool(
  'send_file',
  {
    description: 'Send a file (PDF, document, etc.) to a contact, group, or channel via a public URL.',
    inputSchema: {
      session: z.string().describe('Session name'),
      chatId: z.string().describe('Recipient: phone number, group ID, or channel ID'),
      fileUrl: z.string().url().describe('Public URL of the file'),
      filename: z.string().optional().describe('Filename to display in the chat'),
    },
  },
  async ({ session, chatId, fileUrl, filename }) =>
    toolResult(
      await callApi('POST', '/v1/sendFile', {
        session,
        chatId,
        file: { url: fileUrl, ...(filename ? { filename } : {}) },
      })
    )
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('WhatsApp Messaging API MCP server running on stdio');
