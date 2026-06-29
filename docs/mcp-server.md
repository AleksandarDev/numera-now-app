# Numera MCP Server

Numera exposes an MCP server at `/api/mcp` for authenticated clients that need to query or operate in-app finance data.

## Transport

- Protocol: MCP Streamable HTTP
- Endpoint: `/api/mcp`
- Runtime: Next.js route handler on the Node.js runtime
- Session mode: stateless
- Response mode: JSON responses

The server uses `@modelcontextprotocol/sdk` and `WebStandardStreamableHTTPServerTransport`. Stateless JSON responses are intentional so the endpoint works predictably on Vercel serverless instances without relying on in-memory MCP session state.

## Authentication

MCP requests must authenticate through Clerk. The route accepts Clerk-authenticated requests through `authenticateRequest` and scopes all tools to the resolved `userId`.

Recommended client setup:

- Use HTTPS against the deployed app URL plus `/api/mcp`.
- Send a valid Clerk session token or other Clerk-accepted token in the request authentication headers.
- Treat the MCP connection as user-scoped; there is no cross-user or admin mode.

Unauthenticated requests return a JSON-RPC error response with HTTP 401 before the MCP transport handles the request.

## Read Tools

Read tools are scoped to the authenticated user and use shared finance entity services:

- `numera_whoami`
- `numera_list_transactions`
- `numera_get_transaction`
- `numera_list_customers`
- `numera_get_customer`
- `numera_list_customer_ibans`
- `numera_list_accounts`
- `numera_get_account`
- `numera_list_tags`
- `numera_get_tag`
- `numera_list_documents`
- `numera_get_document`
- `numera_list_audit_events`

List tools support bounded `limit` and `offset` arguments where applicable. Deleted records are excluded by default and require explicit `deleted: "include"` or `deleted: "only"` arguments on supported tools.

Document list tools do not include download URLs by default. This avoids leaking short-lived blob URLs into LLM context unless a future tool intentionally exposes that workflow.

## Mutation Tools

Mutation tools are also scoped to the authenticated user and use shared lifecycle services:

- `numera_delete_transaction`
- `numera_restore_transaction`
- `numera_purge_transaction`
- `numera_delete_customer`
- `numera_restore_customer`
- `numera_delete_document`
- `numera_restore_document`
- `numera_purge_document`

Soft-delete and restore tools write audit events with MCP source metadata. Purge tools are permanent and require `confirm: true`; callers should prefer soft delete unless the user explicitly asks for permanent deletion.

## Maintainer Guardrails

- Add new MCP tools through `lib/mcp/*-tools.ts`.
- Put business logic in `lib/services/*` first, then call it from MCP tools and API routes.
- Do not query Drizzle directly from a tool handler unless the same behavior has first been extracted into a shared service.
- Keep every tool user-scoped by passing `context.userId` into services.
- Return structured JSON-safe data through `createJsonToolResult` or `createJsonErrorToolResult`.
- Mark mutating tools with `readOnlyHint: false` and `destructiveHint: true`.
- Require explicit confirmation for permanent or non-recoverable operations.
- Preserve audit events for every mutation and include source metadata that identifies MCP.

## Verification

Expected local checks for MCP changes:

- `./node_modules/.bin/biome check --write ...`
- `node --experimental-strip-types --test tests/mcp-server.test.mjs`
- `./node_modules/.bin/tsc --noEmit --pretty false`

When schema or lifecycle services change, also run the relevant lifecycle tests for transactions, documents, customers, and audit behavior.
