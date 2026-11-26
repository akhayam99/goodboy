# Frames and artifact files

> **Read this when** you change how a wireframe shows in its isolated frame,
> how an artifact opens outside the app, or what its file on disk carries.
> **Not for** where the mirror lives ([data-layout.md](data-layout.md)). The
> other pages are listed in [architecture.md](../architecture.md).

## Frames

The app never renders a wireframe in its own DOM. It shows its real pages in
an isolated frame.

1. The viewer compiles the spec with the renderer that writes the folder
   (`features/wireframes/wireframePages/`).
2. It hands the pages to Rust with `frame_stage`.
3. It shows them in an `<iframe sandbox="allow-scripts">` on the `gbframe`
   scheme (`gbframe://localhost/<stage>/<page>`, `http://gbframe.localhost/...`
   on Windows).

`frame_release` drops a stage when the viewer unmounts. Stages live in memory,
at most 16 MB, least recently used out first.

- **No same origin.** Without `allow-same-origin` the origin is opaque: no
  access to the parent, no cookies, no top navigation, no forms, no popups, and
  no Tauri capability covers it. Every `gbframe` response carries its own CSP
  (`default-src 'none'`, styles and scripts only from `gbframe`,
  `connect-src 'none'`, `form-action 'none'`) and `Cache-Control: no-store`.
  The app CSP only adds `frame-src gbframe: http://gbframe.localhost`.
- **One script of ours, only on the stage.** Rust adds `/_gb/stage.css` and
  `/_gb/stage.js` (`src-tauri/src/frame_stage.*`) to `<head>`; the file never
  holds them. The stylesheet hides the page chrome (`.wf-page-chrome`).
- **Agent text only escaped.** The renderer escapes every spec string; no agent
  string becomes a script, a `style` or an `on*` attribute.

### Messages

The script talks to the parent only with `postMessage`, and finds nodes by
their `data-node` mark. The parent accepts a message only when `event.source`
is that iframe's `contentWindow` and its shape parses
(`frame/frameMessage.ts`).

- **To the parent:** `navigated { path, height }` on load, and
  `picked { nodeId, label }` and `pickEnded` while Pick is on.
- **From the parent:** `pick { isOn }`, `reveal { nodeId }` and
  `variant { variantId }`, which sets `data-variant` so the generated
  stylesheet hides nodes outside that release cut.

## Opening an artifact outside the app

There is no reader window and no print window. A plan, a report and a
wireframe render through `ArtifactDocument`: `medium="screen"`, themed, in the
app, and `medium="file"`, always light, on disk.

`Open in browser` follows the Links setting. Beside the session it opens a
local tab from `artifact_mirror_path`. Outside (`artifact_mirror_open`) it
uses the browser chosen in Settings (`chosen_browser_launch`), else the OS
default web browser, never a `.html` file's default app:

- **macOS** asks Launch Services (`LSCopyDefaultApplicationURLForURL`, via
  `core-foundation-sys`) and **Windows** the shell's association API
  (`AssocQueryStringW`, via `windows-sys`), natively, never through `defaults`
  or `reg`. Both fall back to `proc::open::open_path`.
- **Linux** uses that opener, which resolves the browser through `xdg-open`.

`⌘P` there prints with the browser's own dialog. The lens header's
`Show in Finder` opens `~/.goodboy/workspaces/<slug>/artifacts/`
(`artifact_mirror_open_root`), since `~/.goodboy` is hidden.

## The file on disk

- **Never stale.** `meta.json` carries `rendererVersion`
  (`ARTIFACT_RENDERER_VERSION`) beside `revision` and `updatedAt`, and Rust's
  `is_current` compares all three. A restyle that bumps the version alone
  marks every mirrored file pending, and the post-boot backfill rewrites them.
- **No runtime style.** No `<style>` element and no runtime `style` string:
  Tauri adds a nonce to the CSP and the webview then drops `unsafe-inline`.
  The styles live in `artifactDocument.css`, keyed on `data-medium`
  (`@media print` inside `file` covers paper).
- **No network call.** Every file carries its own `Content-Security-Policy`
  meta tag (`default-src 'none'; …`).
