---
name: sync-agent-context-docs
description: Update and synchronize repository context markdown files (CLAUDE.md and AGENTS.md) so both stay identical after documentation/context changes. Use when asked to update project guidance docs, sync agent context, or keep Claude Code and Codex instructions aligned.
---

# Sync Agent Context Docs

Use this skill when this repository keeps both `CLAUDE.md` and `AGENTS.md` as shared agent context and they must remain identical.

## Goal

Update one canonical file, sync the other file to match exactly, verify equality, then commit with a Chinese message.

## Workflow

1. Read `CLAUDE.md` and `AGENTS.md` and determine the requested changes.
2. Edit one canonical file first (prefer `CLAUDE.md` unless the user says otherwise).
3. Run `scripts/sync_docs.sh CLAUDE.md AGENTS.md` to copy and verify.
4. Confirm the files are identical (`cmp -s`).
5. Commit after the change is complete, using a concise Chinese commit message.

## Commands

```bash
skills/sync-agent-context-docs/scripts/sync_docs.sh CLAUDE.md AGENTS.md
```

Manual fallback:

```bash
cp CLAUDE.md AGENTS.md
cmp -s CLAUDE.md AGENTS.md
```

## Guardrails

- Do not keep different content in the two files unless the user explicitly requests it.
- If only one file exists, update it and report the missing counterpart.
- Keep the docs focused on current repository behavior (controls, performance optimizations, testing flow).
