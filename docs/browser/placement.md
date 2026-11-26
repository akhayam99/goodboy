# Placing the native view

> **Read this when** you change how a tab's view is shown, hidden or moved over
> the app page, the overlay rule or the covers. **Not for** which surface owns
> the view ([page.md](page.md#one-view-one-place)).

A tab's view is a native webview drawn above the app's DOM, so nothing in the
DOM can cover it. One loop places it at a placeholder and hides it under any
overlay.

## Placement

`createNativePlacement` owns show, hide and `set_bounds`; nothing else may
place, show or hide a tab.

1. Every frame, and whenever the view's frame resizes, it measures the
   placeholder (`viewBoundsOf`).
2. It wants the shown tab at that rect, or no tab when the placeholder is
   gone, hidden or covered.
3. It runs one host call at a time toward the latest wanted state, showing the
   new tab before hiding the old one.

The placeholder is in CSS pixels, and app zoom (`shared/lib/zoom.ts`) makes
one CSS pixel `zoom` window points. `viewBoundsOf` multiplies the rect, the
device cap included, by this window's `appliedZoom` and rounds each edge,
never the width, so the view meets the chrome on every side. A zoom, window
or dock resize moves the view on the next frame. After a reload the webview
keeps its zoom and `applyStoredZoom` sets the same factor. WebKit raises
`devicePixelRatio` with the zoom, and `watchTerminalFit` refits the terminal
when the ratio changes.

The `ResizeObserver` watches the view's frame (`BrowserView`), mounted with the
pane, never the placeholder, which mounts only once a tab is shown. A row or
notice that grows the chrome then moves the view at once, even with no frame
running.

### Failure paths

- A live id the host answers `tab-gone` for is dropped, so the next frame
  reopens the row.
- A failed hide stays on the list and is tried again next frame.
- A wake that answers after the wanted tab changed is never placed or shown. A
  failed wake stops trying that tab until Reload or a new address.
- Closing the pane hides the view. A pane gone mid call or after a failed hide
  retries the hide a few times (`STOP_RETRIES`), since no frame will ask
  again.
- Before ⌘R reloads the window, every owned view is hidden (`hideOwnedViews`,
  capped wait): the reloaded page no longer knows their ids.

## Overlays

An overlay is any element that matches `OVERLAY_SELECTOR`
(`shared/keyboard/overlaySelector.ts`): a menu, a popover, a dialog, Search or
run. While one intersects the placeholder the view is hidden; elsewhere in the
window it stays shown.

- A popover is measured by the children of `[data-dropdown-portal]`, since the
  wrapper has no height. An element with no area never counts.
- A tooltip (`[role="tooltip"]`) covers too, but stays out of
  `OVERLAY_SELECTOR`, which also gates shortcuts.
- A studio page (`[data-studio-slot]`) counts only for a view under it in the
  sheet; a dock floating over a narrow page keeps its view.
- A floating dock or detail (`[data-panel-over-page]`) and a list rail over the
  page (`[data-rail-over-page]`) hide a view they cross, but not a view inside
  them.

The rules a new floating surface must follow are in `docs/traps.md`.

### Covers

A hidden view leaves a cover (`BrowserCover`) on the subtle surface: favicon,
title, host and one reason line (`coverReasonText.ts`, from
`createOverlayWatch().coverOf`: menu, dialog, tooltip, page or drag).

Two moves hide every view in the window, so the page is placed once at the end
and not every frame:

- **A face swap**: while the session moves between Overview and Desk,
  `PaneSwap` sets `FACE_SWAP_ATTRIBUTE` on the body, with no reason line.
- **A drag**: while a `SplitHandle` or a panel head drags (`useDockDrag`,
  value `move`), the body carries `SPLIT_DRAG_ATTRIBUTE` until release or
  unmount, also through renders mid drag.

Under a cover the host only hides: a hide never sleeps a tab inside the live
cap, and the release place lands before the show, so the page returns at the
new rect without a reload. The cover goes one frame after the host showed the
view (`onShown`), and stays if the show fails.

Toasts keep left of the pane and of the Browser page's view (`toastRightOf`),
so they never sit under a view.

## Under the hood

- `createNativePlacement.ts`, `hooks/useNativePlacement` and
  `createOverlayWatch.ts`.
- Tests: `createNativePlacement.test.ts`, `createOverlayWatch.test.ts`,
  `faceSwapCover.test.tsx`, `splitDragCover.test.ts`,
  `keeps_a_page_live_under_a_drag_cover_and_shows_it_at_the_release_place` in
  `registry.rs`, and `BrowserPane/index.test.tsx`.
- Scene: `browser-pane-cover`, light and dark.
