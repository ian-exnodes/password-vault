# Project Working Agreement

## Code discovery

This repository uses `codebase-memory-mcp`. Prefer graph tools for code discovery in this order:

1. `search_graph`
2. `trace_path`
3. `get_code_snippet`
4. `query_graph`
5. `get_architecture`

Use text search for literals, configuration, documentation, or when the graph is insufficient.

## Planning and progress tracking

- Treat `docs/PRODUCT_PLAN.md` as the product and delivery source of truth.
- Keep the status and checklist in `docs/PRODUCT_PLAN.md` current while implementing work.
- After completing any task or phase, append an entry to `docs/PROGRESS.md` in the same change.
- A progress entry must include the date, task/phase, outcome, verification performed, important decisions, and follow-up work.
- Never mark a phase complete while required acceptance criteria or verification remain unfinished.
- Record security-relevant design changes in both the plan's decision log and the progress entry.
- When a phase meets all exit criteria, update the plan and progress log, create a phase-completion commit, and push it to the configured GitHub remote.
- Never push an incomplete phase merely because its individual tasks are finished. Do not push until a remote is provided and its target branch is confirmed.

## Product direction

- Build a mobile-first, zero-knowledge password vault.
- MVP is operated by one user, but data ownership, authorization, and schema must remain multi-user-ready.
- Do not add sharing or family-vault behavior until tenant isolation and authorization tests exist.
- Do not invent cryptographic algorithms. Use reviewed libraries and version every encrypted payload.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
