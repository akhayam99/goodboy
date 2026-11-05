# Recipe: a website page

> **Read this when** you add or change a page under `website/`. **Not for**
> release copy (the release units own it, [release.md](../release.md)).

## Steps

1. The website is a standalone package: install and build from `website/` ([website/README.md](../../website/README.md)).
2. Add the page under `website/src/pages/<name>/`, with its own `main.tsx`, and draw it from the shared pieces in `website/src/components/`. The tree map is at the top of [website/README.md](../../website/README.md).
3. Copy is human first and short; no license terms, no internals ([tone-of-voice.md](../tone-of-voice.md)).
4. Images use the brand pipeline ([brand.md](../brand.md)); a mock screenshot never carries a real name.
5. Do not add telemetry; the cookieless visit counter is the only exception (`SECURITY.md`).
6. A feature page changes `website/src/pages/features/features.data.json` together with `FEATURES.md`.

## Test

A build from `website/` and a test beside the page when it holds logic. The build ends with `pnpm check:seo`, which fails on a page without a unique title and description, a canonical or a sitemap line, or on a broken internal link; a renamed URL needs a redirect in `website/vercel.json` ([website/README.md](../../website/README.md) → Search and sharing).

## Docs that move

[website/README.md](../../website/README.md) when the build or a route changes.

## Failure-mode rows that apply

Not applicable: a static page, no state write.

## Guards

`comment`, `em-dash` and the original rules reach `website/src`; `check:doc-refs` checks links.
