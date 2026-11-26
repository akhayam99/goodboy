# Chat view

> **Read this when** you change how a turn reads in the chat: the reading
> order, the turn footer or how the chat scrolls. **Not for** how live text is
> paced ([text-reveal.md](text-reveal.md)) or how `Markdown` lays out a body
> ([../../packages/ui/DESIGN-SYSTEM.md](../../packages/ui/DESIGN-SYSTEM.md),
> Markdown blocks).

## Reading order

An agent turn reads in one order: outcome line, artifact cards, next action,
chips, then notes folded away. `features/chat/readingOrder/` owns it, and
`readingBudgets.ts` holds every budget (outcome 100 characters, 3 artifact
cards, 4 chips, an answer clamped at 12 lines).

### Folding

`readingOrderOf` is pure. It splits the rows into turns at each `user_text`,
`handoff`, `oq_answer` and `auto_delivery` row. In a finished turn the last
`assistant_text` is the answer (`answerClampLines`). The earlier ones become
one closed **Earlier in this reply, N lines** line (`ReadingNotes`) in place of
the first of them; the others draw nothing.

- A text with a control marker is never folded.
- A turn with a text of the active run is live and untouched, so the reveal
  types it whole.
- A turn with an `error` item keeps its notes open.
- A live reply that ends is never folded under the reader's eyes.
  `useReadingOrder` keeps it open (`unfoldedKeys`) until every held text has
  scrolled above the top of the viewport (`scrollerRef` of `ChatView`), or on
  error.

### The first message and the renderer

The first message of an agent keeps one shape whether or not an answer exists.
While an agent is still named by its role, the page title is its brief (first
line): a click opens **Read full brief**, a double click renames it, and the
kind chip is dropped. A named agent keeps the chip and its name.

`ReadingOrderMessage` is the only place agent prose reaches `Markdown`. It
draws the optional `OutcomeLine`, the text, then the chips with **+N** past 4.

- Only prose is clamped with **Show more**. A message with a fenced block or a
  table never is (`hasUnclampableBlock`).
- `AssistantText` is a thin caller with no copy row. **Copy** is a
  `row-actions` button at the message root's top right (`group/row`), shown on
  hover and focus, and always in the context menu (`message.copy`).
- `AssistantText` reads `parseOutcomeLine` from the raw text, before the
  markers are stripped, and passes a neutral `outcome` once the message is
  complete and revealed.
- `AutoResultCard` and `DelegationResult` use the same pieces without the
  message renderer: `OutcomeLine`, chips (`DelegationResultChips`, same budget)
  and `ReadingNotes`, never a stack of rows.

`TranscriptRows` groups its rows into one `<li data-turn>` per turn
(`splitTurns`). The parent list owns the 32px turn gap and each turn list the
16px block gap (`PANE_RHYTHM.transcript`). A day chip or a New divider opens
its turn, and the thinking tail joins the last turn.

## Turn footer

A `TurnFooter` (`features/chat/components/TurnFooter/`) renders on its own row
under the run's last assistant message. `usage` items stay out of the
operations cluster (`ABSORBED_KINDS` in `cluster-operations.ts` holds only the
permission events). One `usage` item merges every `usage` event of a `runId`
(`sumUsage`), because OpenCode reports several `step-finish` events per run.

### Numbers

`useTurnFooter` reads its numbers from the store, not from the item:

- Tokens, context size and cost: `sessionTelemetry[sessionId]` summed for the
  item's `runId`.
- Provider, model and effort: `runRouting[agentId][runId]`, which
  `listAgentTurnSpanRoutes` seeds from persisted spans on reload.
- Until telemetry lands (it can lag one store write), the item's own
  `ProviderUsage` numbers, with no provider or model.
- A cost of exactly zero hides the cost entry: zero usually means unknown.
- A Copilot turn has no dollar price. The footer reads `premiumRequests` from
  the item's own usage (telemetry has no column for it) and shows "N premium
  requests" in place of the cost (`premiumRequestsLabelOf`).

`usageFigures` and `usageDetailRows` (`chat/utils/`) are the only places the
detail numbers are computed, shared by `TurnFooter` and `AgentUsageFooter`. A
row with nothing to show renders a dash and a screen-reader reason, never a
blank.

### Outcome and duration

`turnFootersFor` (`utils/turnOutcome.ts`) derives per run with a `usage` item:

- `outcome`: `done`; `stopped` once a later run is active or the turn ended
  with no `done` or `error` for it; `failed` once an `error` lands for it.
- `startedAt`: the earliest timestamp any item of that `runId` carries, else
  the `usage` item's own `at`.

Duration is `startedAt` to the `usage` item's `at`, so a text-only turn
measures only from its usage event. `ChatView` computes this once per render.

### The line and the detail

The line (`TurnFooterSummary`) carries the provider mark, model, premium
requests and duration.

- A `done` footer on the same provider and model as the footer before it
  (`previousRunId`) drops the mark and the model, so the speaker is named once.
  A stopped or failed footer always names it.
- A `stopped` or `failed` footer shows its `WorkNode` glyph and a token count,
  never the full stats line.
- A `done` footer's glyph is the provider's. Clicking it (or `ⓘ`) opens
  `TurnFooterDetail`, an `AnchoredPopover` with tokens, cache share and context
  window.
- The transcript pane's agent total (`AgentUsageFooter`) keeps the full
  `UsageStatsRow`.
- The detail's `useDropdown` sets `width: 'w-max'` and
  `maxWidth: USAGE_CARD_MAX_WIDTH`. Without a `width` the dropdown takes the
  narrow trigger's width and the `Popover` surface (`overflow-x-hidden`) clips
  the value column.

## Chat scroll

The chat scrolls inside the `ScrollFade` viewport of `ChatView`.
`useScrollAnchor` and `useScrollPin` share it, and only one of them writes
`scrollTop` at a time.

### The anchor

`useScrollAnchor` keeps the line under the reader in place, because WKWebView
and WebKitGTK have no CSS scroll anchoring
([../traps.md](../traps/scroll.md#scroll-anchoring-in-the-webview)).

1. On every scroll it picks the first row whose bottom is below the top edge
   (`pickAnchor`, a binary search) and keeps its offset.
2. A ResizeObserver on every row and the content runs after layout and before
   paint.
3. When the anchor moved, `anchorShift` adds the difference to `scrollTop` in
   that frame.

`ChatView` also tracks the viewport top (`isTopTracked`), so a box above the
transcript that grows, such as the run glance line's Settings, leaves the text
where it was.

The anchor stands down while `useScrollPin` holds the view (`isHolding`),
during a drag or a click on the thumb track, and after `suspend()`. Every
programmatic smooth scroll calls `suspend()` first. It anchors again 150 ms
after the last scroll of such a move, or at the next wheel, touch, key or
pointer press.

### Pinned to the bottom

`useScrollPin` follows the latest line only while the reader is within 32 px of
the bottom. The first wheel, touch, pointer or key event stops its settle loop,
and a reader who scrolled up is never pulled down by new rows; "Scroll to
latest" pins again. A
`ResizeObserver` on the content runs the same follow step, so text that grows
frame by frame stays in view.

### A revealing answer

While a row carries `data-reveal-answer`, the follow stops at the answer's top:

1. The view follows until the answer top is 56 px under the view top (clear
   of the 48 px fade), then holds, and "Scroll to latest" shows.
2. When the written text reaches the bottom of the view, `onRevealOverflow`
   finishes the reveal (`revealPacer.flush`).
3. When the reveal ends the view stays where it is.

A reader who scrolls ends the hold. "Scroll to latest", or a scroll to the
bottom, follows the bottom again until the reveal ends.

### A sent message

A sent message moves to 40 px under the view top, or to the scroller's top
padding when that is larger, and the reply grows downward from it. Under a
pinned header the padding includes `--reveal-inset`, and `anchorTopOf` reads
it, so the message rests below the header.

- `ChatView` passes `anchorKey`, the key of the last `user_text` or `handoff`
  (`anchorKeyOf`), only once the transcript is loaded. The first key after an
  agent opens is never anchored, so opening a session lands on the bottom.
- A later key anchors the last `[data-turn]` (`applyFollow`, held through
  `isHolding`) until the reader's first scroll. The reader is then pinned only
  on reaching the bottom again.
- `[data-transcript-tail]` is the one floor, 24 px (`TRANSCRIPT_FLOOR_PX`)
  under the last line. After a send it gets a spacer,
  `clientHeight - anchor line - last turn - 24`, never below zero, which
  shrinks as the reply grows. A different agent resets it.

### Scroll to latest and the New divider

`JumpToLatest` is mounted all the time. It shows when the content (not the
spacer) ends 32 px or more under the view (`isBehind`). At the bottom, or while
a question pill shows, it is `inert`, `aria-hidden` and transparent, and it
fades in instead of mounting, so it never pops in during streaming.

**New** (`NewRowsDivider`) marks the first unseen row of an agent with an
unread reply. `selectAgent` keeps the previous `lastViewedAt` in
`agentUnseenSince` before it stamps the agent viewed (`unseenBoundariesOf`),
and drops it when another agent is selected. `firstUnseenRowKeyOf` places the
divider only when a later dated row exists. An agent never viewed has no
divider.

### Row heights

Every row is `content-visibility: auto` (`ChatView/rowBoxOf.ts`) with a
`contain-intrinsic-size` of `auto <px>`:

- The last measured height for that agent, mode and row key
  (`ChatView/rowHeightCache.ts`, written from each row's `data-anchor-key`), so
  a revisit does not fall back to estimates.
- Else `rowEstimatePx` (`ChatView/rowEstimatePx.ts`), which sizes each kind on
  the 880 reading column and its clamps.

`useRowPreload` marks every row within a screen of the view with
`data-row-near`, which draws it, so a row is measured and corrected for before
it scrolls in. `ClampedText` decides **Show all** before paint. Estimates still
matter: each error changes `scrollHeight` and slides the thumb. The day divider
key is the day plus its opening row's key, never the index.

## Under the hood

- `reading-order.test.ts` counts `<Markdown` in `features/chat` and
  `features/auto` outside `readingOrder/` against
  `reading-order.baseline.json`; the count only falls.
- The scroll tests prove the decisions (`pickAnchor`, `anchorShift`, the hook
  on a fake layout) and the wiring, since jsdom has no layout.
- `pnpm validate:scenes --only reading-hold` fails when opening Settings moves
  the text under the reader by more than a pixel.
- The `transcript-long` scene is the manual check: scroll up slowly and with a
  flick, and drag the thumb; the line under the pointer never moves.
