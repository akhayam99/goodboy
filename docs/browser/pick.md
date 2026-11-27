# Pick an element

> **Read this when** you change Select an element. **Not for** the console
> that shares its runtime ([console.md](console.md)).

Select an element sits in the address row before Console, in the pane and on
the Browser page, with the `SquareDashedMousePointer` glyph. `browser.pick`
(⌘⇧C, Chrome's inspect key) toggles it while a tab is shown and the session has
a live agent, and as a page key it works with focus in the page. On the page
the session is the shown tab's, and Add keeps you on the page.

## In the page

`page_runtime/pick.js` listens for an event under the read name plus `:pick`
(`console::pick_event_name`) carrying `start`, `stop` or `read`.

On `start` it adds one host element with every style inline and `!important`,
a closed shadow root and a layer over the view, so page CSS cannot hide it and
its capture listeners stop every pointer event before the page's. It draws the
hint, an outline and a label under the pointer (the React component when the
fiber has a `_debugOwner`, else tag, class and size), and a filled outline per
pick. A click picks one, ⇧-click adds or removes one, up to four
(`MAX_PICKS`). Esc in the page stops and marks the pick as left.

A pick notes the tag, a label, a selector (an id or `data-testid` anchor, else
up to five `nth-of-type` steps), the visible text (1,000 characters), the
outer HTML (4,000), fifteen computed styles, the rect in view points and the
address.

On a loopback page it also finds the source:

1. It takes the first same-origin frame of the fiber's `_debugStack` outside
   `node_modules`, `.vite` and `/@`.
2. It fetches that module with the page's original `fetch`.
3. It maps the line through the inline or same-origin source map, giving the
   original line and the path from the map's `sources` and `sourceRoot`.

Another origin, `node_modules` or a path above the served root gives no file.
React before 19 or a production build gives no component and no line, and the
rest still works.

## The read

`browser_pick` takes the tab id, the session id, the op and the last round
seen. It refuses like the console read (`session_tab`), runs with
`eval_with_callback`, and parses the answer as page data
(`pick::pick_answer_of`): at most 200 kB, a load id, four picks with every
field capped, a rect only when finite and at least one point each way, a
source only with an absolute path and a line. When a later round brings picks
it gives focus back to the app window, so the note takes the keys.

`useElementPick` sends `start` on the gesture, turns on only after the page
answers, then reads every 150 ms, dropping answers for an older gesture.

- A new load, an unheard runtime, `isOn: false`, a failed read or another
  shown tab ends the pick.
- A failed read, another tab, a hidden pane and an unmount send `stop`, even
  for a start not yet answered.

## The note

`BrowserPickNote` sits under the address row, not over the page, since
anything over the native view covers it. It is typed in the app, so a page
never writes into the draft. Its head is the component and `path:line`, or the
element count; the target is the agent `useHandOutputToAgent` names, or a menu
when the session has several. Enter adds, ⇧Enter is a new line, Esc leaves and
stops the page.

## Add

`addPickedElements` captures the tab, load id, agent, picks and note at the
gesture.

1. It sends `stop`, so the overlay goes and the rects are fresh.
2. `browser_element_snapshot` crops each rect. It refuses a changed load id or
   a tab that navigated during the picture. On macOS it uses a
   `WKSnapshotConfiguration` after screen updates, at the view's scale; an
   empty image or one over 5 MB is none, and other systems give none. A crop
   that returns after the shown tab changed is dropped.
3. `elementAttachmentOf` writes one markdown file per element: address, page
   content note, heading, file line, selector, size, text, styles and HTML cut
   at 4,000 characters, through `redactSecrets`, with a source of kind
   `element` and a PNG when there is a crop (`dataBase64`).
4. The files go through `queueOutputHandoff` and the note joins the agent's
   draft. Nothing is sent. The pane opens that session when another one is on
   screen; the page passes `shouldOpenSession: false` and stays.

`elementFileOf` maps the served path into the worktree only when the page's
loopback port is listening for a process this session owns (worktree, then the
process folder, then the path); a climbing path gives none. The app stops
reading the page while it adds, and a failed add keeps the picks and the note
for a retry.

## Under the hood

- `browser/pick.rs` drives the picker and parses its answer;
  `browser/snapshot.rs` crops an element.
- Tests: `browser::pick::tests`, `browser::snapshot::tests` and the two
  `pick.test.tsx` (BrowserPane, BrowserStudio) pin the caps, the refusals and
  the flow in the pane and on the page.
