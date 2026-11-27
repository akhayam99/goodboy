# Traps in the window, drawers and rendering

> **Read this when** you change navigation, a drawer, the dock, the session
> rail, a keyboard or mouse path, terminal output, a timeline row, Markdown
> rendering, a hover card or the theme.
> **Not for** scrolling and the text reveal ([scroll.md](scroll.md)), browser
> tabs ([browser.md](browser.md)) or the visual rules
> ([../styling.md](../styling.md)).

## Drawers and the dock

### `navigate` closes the drawer unless it is a tool of the same session

The drawer belongs to the history entry, so `navigate` closes it unless it is a tool of the session it stays in (`keepToolDrawer` reads the `tool` rows of `DRAWER_KINDS` that light a pane). A reader, an item or a form never survives a move, and a row never opens a tool. Terminal and Browser stay on every place (`keptTool`) and may carry `sessionId: null`, so check `drawer.sessionId` before indexing by it and never read it as the current session.

### A parked drawer is still mounted

A drawer parked under a studio stays in `state.drawer` and mounted (`DrawerHost` and the shell read `selectOpenDrawer`; `DrawerColumn` hides it with `isParked`). A workspace tool under its own page is not mounted (`useShellRight`), so its shortcuts never answer twice.

- A close path reads `selectDrawerPanel` (null under a studio unless a workspace tool shows beside it). `selectOpenDrawer` answers what the session holds, so closing through it closes a drawer nobody sees.
- A toggle (`togglePane`, `toggleDrawer`) leaves every stacked page first (`leaveStudio`; one `closeStudio` only steps back once), then shows the drawer, and never closes one on a page.
- The parked aside leaves the flow, so the hidden session widens under the page, narrows on return, and its transcript re-wraps.

Escape layers in a parked drawer are suspended, not removed (`DrawerParkedContext`, read by `useEscapeLayer`), so Esc reaches the page and, after the trip, an inner step such as a plan in Ask answers before the frame. `DrawerParkedContext` wraps only the drawer, never `main`, so a frame in a page keeps its Escape.

### New drawer actions host

Start sits in a sticky host at the end of the body (`actionsHost` in `NewDrawerBody`), not the `DrawerFrame` `dock` slot: a dock is a footer bar and `forbidden-patterns` fails on it. The Run, Agent and Write panels portal their actions there through `Docked`, so each renders nothing until the host exists. `WritePanel` lives in `features/artifacts` and arrives as the `writePanel` prop from `DrawerHost`, because `features/session` must not import artifacts components.

### A fold is a view, never a write

When the dock has no room, the solver turns a cell into a tab of its neighbor at render time, from the window width and `dockFoldOrderOf`. Nothing reaches `drawerGrid` or `session_dock_grids`, so a smaller window never rearranges the saved layout; writing the fold would lose it on the first laptop that leaves its monitor. The one nearby write is the toast's **Undo**, which closes the panel just opened (`announceDockFold`). A tab torn out of a folded cell is the one case where a fold feeds a write: the move names that one tab and re-solves, it never writes the fold the user saw, and the other folded tabs stay a view.

### Ask and Scripts are cells of the grid

Like Terminal, Browser and Monitor, so a version 2 layout row holds up to five kinds (`storedDockGridOf`). Version 1 rows still read, but a version 1 build cannot read version 2; an unparseable row leaves the default layout and says so once per session (`unreadableDockGrids`). The Ask state has no store key of its own: `selectIsAskOpen` reads the grid, and `openAsk` and `closeAsk` write it for the session they name.

## The session rail

### The session rail has one current branch

The rail has no worktree level: it stays on the session level, and only the row of the mount the Branch page shows draws its status line and pages (`isOpened` in `SessionLevel/WorktreeRow`, from `useBranchIdentity`, which needs an active mount or a `diffMountPath`). With the Branch lens but no resolvable mount the rail draws no pages, so a test world sets `sessionActiveMount`.

Folds are remembered per branch in `goodboy:session-rail-tree-open:v1`, so clear it between tests. A click on a row that is not current writes an open choice (`useRailTreeOpen.open`), or the saved collapse hides the page it just opened. The current row's pages navigate with `mode: 'replace'`, like a tab switch; a push would make Back walk through tabs.

## Keyboard and mouse

### The menu bar and the web view share every Command key

The web view sees the key first: `preventDefault` in a handler stops the native item, and an unhandled key falls through to it. So a key runs once either way (`app_menu.rs`, `useMenuCommands`), and a menu row carries the registry's combo. Add no ⌘Z or Undo menu row: the predefined Edit > Undo leaves the press to the text field, the terminal and the Commits page. Add no second `goodboy://menu` listener.

### A right click reads the selection held before the press

On macOS a right click selects the word under the pointer, then fires `contextmenu`, so a policy reading `window.getSelection()` then hands every selectable row to the webview menu (Look Up, Translate, Services). `useNativeMenuPolicy` reads the selection at `mousedown` (capture), and only a prior selection inside `data-reading-region` counts. Never move the check back into `useObjectMenuTrigger` or drop `select-none` from `ROW_HOVER`.

### Drags use pointer events, never HTML5 drag and drop

Rewrite history and the issue chip share `usePointerDrag` (5 px threshold, window listeners removed on finish, an Esc layer, an opt-in start on a button that still clicks), each with its own hit test (`useHistoryDrag` for commit rows, `useTaskDrag` for `data-task-drop`). While `dragDropEnabled` is on, the native file drop handler owns every drag, so WebKit sends the page no `dragover` or `drop` and an HTML5 drag does nothing while jsdom stays green. Turning `dragDropEnabled` off breaks the composer's `onDragDropEvent`; `history-drag-keeps-file-drop.test.ts` holds both.

### Hover card triggers

- A `FactCard` or `Tooltip` trigger is a DOM element that takes a ref, pointer handlers and `aria-describedby`; a component wrapper drops them and the card never opens. Spread the span props onto the element (`TimelineRunGlyph`) or wrap a native one.
- Under `PaneSwap` a hover state survives a hide (`Activity` keeps state and runs cleanups; the anchor gets no pointer leave). `useRestHover` drops its target in cleanup, and a new hover hook must too, or the card returns top left on a stale anchor.
- A focus handler that opens a card checks `isKeyboardFocus`: focus restored after a click or a page change would open a card that never gets a blur or pointer leave.

## Terminal and script output

### A terminal view subscribes before it reads the snapshot

A terminal or script view subscribes to the output events before it asks for the snapshot, and writes an event only when its `offset` plus length passes the snapshot's end, cutting the covered first bytes of a chunk. Subscribing after loses what prints in between; writing every event prints the overlap twice. Offsets are byte counts, so compare bytes, never decoded text.

A character can split across two events. Decode one run's bytes with one streaming `TextDecoder` (`base64Bytes`, then `decode(bytes, { stream: true })`, and a last `decode()` at exit), never `atob` text per event; script runs and provider lifecycle runs do.

A script's text log keeps the last frame of a line redrawn with `\r` (`collapseCarriageReturns`, on every append and again in `splitLogLines`), so a progress bar stays one line and never fills the 64 KB cap. Keep a trailing `\r` in the buffer until the next chunk, or the next frame glues onto the old one.

## Trees and timelines

### A recipe reads top down, a run reads bottom up

`StepTree` (the workflow builder and Studio editor) reads step 1 first and **Add step** last, like text; `RunTree` and the activity timeline read bottom up to NOW, like a log. Aligning them, or copying the run's `flex-col-reverse` into the plan, breaks the `StepTreeLane` geometry and the reorder keys, where up means earlier.

### Timeline rows share one pixel grid

Each row draws its rail piece in its own `<svg>`, so joins stay seamless only on one pixel grid. Never leave a `transform` after an animation (`fill-mode: both` does, and puts the row on its own layer), and never give lines and elbows different `shape-rendering`. Grow rows with `Reveal`, which moves only the grid track; its grid element keeps `min-w-0`, or the widest unbreakable child sets the column and a body overflows the rail.

## Content rendering

### `Markdown` reuses the element of an unchanged block

`Markdown` (`packages/ui/src/components/Markdown/index.tsx`) keeps each block's React element, so an answer that grows by a word renders only its last block. `parseStableMarkdown` returns the same object for an unchanged block (key: index and JSON), and the cache matches that object plus the block id. Do not wrap blocks in `memo`: the renderer lives in `index.tsx` because the lint and style ratchets are keyed to that path.

An open fence (`isClosed: false`) stays plain text until its closing fence, so a streamed block never recolors each line. `markdown.perf.test.tsx` counts `parseInline` calls to prove it.

### A kit block closer can arrive with one bracket too many

Models write `<<</decision>>`. `stripHtml` in `parseMarkdown.ts` would drop `</decision>` as html and nest every later block, so it reads a run of `<` before `/` as `<<`. Keep new tag stripping behind that branch.

### Explore decides text from content, not the extension

`explore_read` sends an image or PDF extension as a data URL and reads the first 8 KB of anything else: a NUL byte or invalid UTF-8 returns `Binary { size }` with no payload, while a multibyte sequence cut at 8 KB still counts as text. Bring back no extension list and widen no data URL list: `.mts`, `.jsonc` and extensionless files stay readable.

### The PDF preview is blank in a release build

It frames a `data:` URL that the CSP `frame-src` refuses. Never widen `frame-src` with `data:` or `blob:` (`csp-img-src.test.ts` fails on both). The lightbox frame carries an empty `sandbox`, and a working PDF needs binary staging through `gbframe`, which stages text only today.

### Links open on `http:` and `https:` only

`editor.rs` `is_openable_url` refuses other schemes, so `parseInline`, the link interceptor and the native menu policy accept the same two and a `mailto:` renders as text. A failed `open_url` in the interceptor is a "Couldn't open the link" notification, never an unhandled rejection that `crashReport` files as a crash.

### Theme switch is an instant swap

A view transition repaints the whole window every frame of a 420ms fade: measured, it doubled main-thread work in Chrome and froze WebKit for 500ms on a large diff. That reads as flicker, worst on the busiest pages, so bring back no circular reveal or cross-fade.

A fixed full-window cover (`opacity` only, 100ms in, 200ms out) waits on a WebKit frame-gap check never run: no gap above 50ms on Settings, an Overview of 30 sessions and a 3,000 line diff.
