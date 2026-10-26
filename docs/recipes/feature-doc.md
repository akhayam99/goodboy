# Recipe: a feature doc entry

> **Read this when** a change adds, removes or renames a main feature item.
> **Not for** the style of the page ([tone-of-voice.md](../tone-of-voice.md)).

## Steps

1. Find the area in the ownership table of [README.md](../README.md) by the glob your change touches. Its doc is `docs/features/<area>.md`.
2. Change the `###` item there. Its first sentence says what the feature does for the reader, in 25 words or fewer. A new item needs its `###` heading and one bullet under the same title in `FEATURES.md`, with its `<a id>` anchor.
3. When the item appears on the site, change `website/src/pages/features/features.data.json` too. Then run `node scripts/split-features.mjs --write`: it writes the bullet in `FEATURES.md` and the text of a main card on the site from that first sentence.
4. Every claim is true on the code you ship. The code path that proves it goes in the `## Under the hood` section at the end of the page, as a bullet that names the item; the body of the page names no identifier and no source path. The PR body cites the same paths. Run `pnpm run check:doc-refs`.
5. Renaming or deleting a symbol, a file or a route means grepping `*.md` for it first.
6. A lesson learned goes into the owning doc, never only into an agent's memory.

## Test

`pnpm run check:doc-refs` and `node scripts/split-features.mjs --check`.

## Docs that move

The area file, `FEATURES.md`, and the site data when it lists the item.

## Failure-mode rows that apply

Not applicable: docs only.

## Guards

`check:doc-refs` (paths, symbols, dead globs, anchors), `check-doc-budget` (no identifier or source path outside `Under the hood`, no sentence over 30 words, no paragraph over 120, a picture description of 25 words or fewer, no screen the app retired, one form for a settings path and a key), `split-features --check` (the bullet in `FEATURES.md` and the text of a main card equal the first sentence of the item, 25 words or fewer), `em-dash`.
