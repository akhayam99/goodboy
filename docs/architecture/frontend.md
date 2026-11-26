# Hidden pages, render errors and the highlighter

> **Read this when** you change how a page that is not on screen is kept, how a
> render error is caught, or how code is highlighted. **Not for** where frontend
> code goes ([file-system.md](../file-system.md)). The other pages are listed in
> [architecture.md](../architecture.md).

## Hidden pages

A page that is not on screen is hidden under React `Activity`, not unmounted
and not kept running.

- The board, the session frame and the draft are layers of one `PaneSwap` in
  `App`.
- The five kept-alive session pages (`KEEP_ALIVE_CAP`) are each wrapped in
  `Activity` by `KeepAliveWorkSurface`.

A hidden page keeps its state, drafts and pending turns, its effects are
cleaned up, and it does not re-render on store writes. So a hook that must work
for a hidden page cannot live in a page effect: `useSessionBranchSync` runs
only for the visible session and re-reads the branch when it shows again.

## Render errors

A render error ends one panel, not the window.

- **Panels.** `PanelBoundary` (`app/components/PanelBoundary`) wraps each
  studio (`AppStudio`), each drawer (`DrawerHost`, keyed by `drawerKey`) and
  each session page (`KeepAliveWorkSurface`). A throw inside one shows "This
  page couldn't be drawn" in that panel with Retry (remounts the panel), a
  leave action (Go to the board, Close drawer or Close) and Report this crash
  (the inline crash report). The rail, the top bar and every other session stay
  alive.
- **The root.** The `ErrorBoundary` in `main.tsx` is the last resort and only
  shows when the shell itself throws. Both use `ErrorBoundary` from
  `packages/ui`; a panel passes `renderFallback`, the root does not.
- **The log.** Both boundaries pass `onCatch={logRenderCrash}`
  (`features/bug-report/logRenderCrash`), which calls `log_render_crash`
  (`render_crash_log.rs`). It writes three `[render-crash]` lines (name and
  message, stack, component stack) to the local log only. Home folders become
  `~`, credentials are hidden and each field is cut to a fixed length.

## Code highlighter

`apps/desktop/src/shared/lib/highlight` is the one syntax highlighter. Shiki
runs in a web worker behind `highlightCode`, with an in-process fallback. The
caps (5,000 lines, 1,000 characters a line) live in `caps.ts`, so a view can
read them without loading Shiki.

The diff (`SyntaxText`, `useDiffTokens`), the chat code blocks
(`APP_CODE_HIGHLIGHTER`) and the Explore file view
(`shared/components/SourceView`) all read it from there.
