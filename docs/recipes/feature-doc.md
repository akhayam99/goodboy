# Recipe: a feature doc entry

> **Read this when** a change adds, removes or renames a main feature item.
> **Not for** the style of the page ([tone-of-voice.md](../tone-of-voice.md)).

## Steps

1. Find the area in the ownership table of [README.md](../README.md) by the glob your change touches. Its doc is `docs/features/<area>.md`.
2. Change the `###` item there. A new item needs its `###` heading and one bullet under the same title in `FEATURES.md`, with its `<a id>` anchor.
3. When the item appears on the site, change `website/src/pages/features/features.data.json` too.
4. Every claim cites a code path that makes it true; run `pnpm run check:doc-refs`.
5. Renaming or deleting a symbol, a file or a route means grepping `*.md` for it first.
6. A lesson learned goes into the owning doc, never only into an agent's memory.

## Test

`pnpm run check:doc-refs` and `node scripts/split-features.mjs --check`.

## Docs that move

The area file, `FEATURES.md`, and the site data when it lists the item.

## Failure-mode rows that apply

Not applicable: docs only.

## Guards

`check:doc-refs` (paths, symbols, dead globs, anchors), `split-features --check`, `em-dash`.
