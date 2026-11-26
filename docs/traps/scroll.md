# Traps in scrolling and the text reveal

> **Read this when** you change a long scroller, the diff body height, the
> chat scroll pin or the word-by-word text reveal. **Not for** other window
> and drawer traps ([ui.md](ui.md)) or motion tokens
> ([../../packages/ui/DESIGN-SYSTEM.md](../../packages/ui/DESIGN-SYSTEM.md)).

## Scroll anchoring

### Scroll anchoring in the webview

`overflow-anchor: auto` does nothing in WKWebView or WebKitGTK, where WebKit keeps CSS scroll anchoring behind a flag. A long scroller whose rows change height above the reader (`content-visibility` rows, late images, rows inserted above) needs `useScrollAnchor` (`shared/hooks/useScrollAnchor`); today the chat transcript and the diff. Never add the CSS property back: the hook sets `overflow-anchor: none`, because Chromium-based WebView2 on Windows would compensate twice.

- A new smooth `scrollTo` or `scrollIntoView` there calls the hook's `suspend()` first, or the first compensation cancels it halfway.
- A settle loop that snaps the view (the diff's `anchorTo`, the chat's bottom pin, the reveal hold) passes `shouldHold`, or the two fight for `scrollTop`. In the chat that is `isHolding` from `useScrollPin`, so one of them owns `scrollTop` at any moment.
- An answer growing below the reader does not move the anchor row's top, so the hook shifts nothing.

Row estimates still matter: the content stays still, but each estimate error changes `scrollHeight`, and the overlay thumb resizes and slides.

### Diff file body height

Each `DiffFile` body is `content-visibility: auto` with `contain-intrinsic-size: auto <estimate>px` from `features/diff/lib/bodyEstimatePx` (rows x 20 px, hunk and gap rows 28 px). A fixed 480 px made the diff jump when a body above the viewport first rendered (scrolling up, a tree jump). Tune the constants in `bodyEstimatePx`, never a per-file class.

Wrapped lines and threads still miss the estimate, so `DiffView` also runs `useScrollAnchor` on its file cards, held while `anchorTo` snaps a picked file to the top. jsdom has no layout, so the test pins the estimate; the real check is a long multi-file diff scene, scrolled up.

## The chat scroll pin

### The reveal hold in the chat scroll

`useScrollPin` finds a revealing answer by `[data-reveal-answer]` and tracks the hold in refs (`isAnchoredRef`, `isLockedRef`, `ownTopRef`), not state. Three things break it:

- A scroll write outside `applyFollow` reads as the reader's, since `onScroll` tells them apart by `ownTopRef`; assign `scrollTop` nowhere else in the pin.
- Reaching the bottom during a reveal sets the lock, which clears only once no revealing answer is in the DOM; without it the follow pulls the view back to the answer top.
- A row must clear `data-reveal-answer` when its reveal ends, or the hold never lets go: derive it from `isRevealing`.

### A reader's upward move unpins at once

`onScroll` reads a move within 2 px of `ownTopRef` as the follow's own, so a trackpad's first 1 px steps were swallowed while streaming and the follow pulled the view back. A reader gesture now stays the reader's for its whole length:

- `onUserScroll` (wheel, touch, key, on the chat host) holds until input and scroll go quiet for `GESTURE_IDLE_MS`.
- `onPointerDown` holds from a press on the scrollbar or overlay thumb until `pointerup` or `pointercancel`; a press on a row is a click.
- During a gesture `applyFollow` writes nothing, and an upward scroll unpins before the own-move test.

`pinned` changes only through `writePinned`, on reader movement, never content size: up unpins, the bottom repins. Landing at the bottom because content shrank (a collapsing tool card clamps `scrollTop`) keeps the pin. A gesture's end unpins on a move up not yet reported, then follows if still pinned, and growth during a hold is followed when it ends. A new input path feeds `onUserScroll` or `onPointerDown`.

## The text reveal

### Live mark for the text reveal

Only text read through `readTurnStream` in this window animates, and `liveTextRegistry.mark` is called there only: `appendTurnEvent` and `bufferTurnEvent` also run for a reload re-attach replay, which would then reveal word by word. The mark is keyed by run id, since stored events have no item key. A host decides at mount; a text not live then grows live only when the registry is live again, and the 1.5 s lag cap in `revealNumbers.ts` makes a later host show it whole.

### A fresh span is cloned with its children spread

`freshenNode` clones the last block with `cloneElement(node, undefined, ...children)`; passing the array as one child makes React ask for keys and the console guard fails. A fresh span's key is leaf index plus piece start, so it keeps its fade only while it stays in the same parent.

### A fading row's piece outlives its delay

A fresh span lives only while its block is last and its piece alive. A table row fades with a delay, so `pieceLifetimeMs` adds the stagger to the fade and the pacer holds the next words that long. Change the stagger or row cap in `revealNumbers.ts` only: a delay past the piece lifetime shows the row at full opacity before it fades.
