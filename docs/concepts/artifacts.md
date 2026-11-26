# Artifacts

> **Read this when** you change how a plan, a report or a wireframe is saved,
> shown, commented on, split into parts or versioned. **Not for** the on-disk
> layout ([../architecture.md](../architecture.md#on-disk-data-layout)) or how a
> run consumes a plan ([../workflows.md](../workflows.md)).

When an agent writes a **plan**, a **report** or a **wireframe**, Goodboy saves
it in the session as an artifact with its own page, so it does not stay buried
in the chat. Goodboy remembers which agent used which plan.

An artifact's status (`ArtifactStatus`) is `active` (waiting for the next
agent), `consumed` (an agent used it), `superseded` (a newer version replaced
it) or `discarded` (taken out of the session). The UI words are Ready to run or
New, Approved, Ran, Replaced and Deleted (`artifactStateOf`); `discarded` is
what Delete writes, for every kind.

## The artifact page

The Artifacts page lists plans, reports and wireframes as one list, newest
first, and opens each in the same page: a small header with at most one main
action, the document at reading size, and a right panel for its details and a
chat with the agent that wrote it.

- Goodboy keeps a copy of every artifact on disk, under the workspace folder.
  The Details panel shows its path under **File**, with **Open in browser** and
  **Show in Finder**. The **New** menu ends with **Show in Finder** for the whole
  workspace folder.
- **Open in browser** opens the file in the system's default web browser, never
  an editor, where `⌘P` prints a PDF.
- Every write keeps its own row in `artifact_revisions`. The Details panel lists
  them newest first once there is more than one, with who wrote each, and
  **Restore** on an
  older one writes it back as a new revision, never over the history. The
  wireframe version pill is a richer view of the same table, not a second one.

## Plans

A plan has a title, then Goal, Context, Approach, Risks, Done when and Out of
scope. It also names the projects the work touches, which a step that writes
code materializes ([lazy-sessions.md](lazy-sessions.md#materialize)).

### Parts and waves

The planner splits a plan into **parts** (the `clusters` of the plan), each with
its checks (`doneWhen`, at most 4), the files it touches (`touches`, at most 12)
and its model (`Auto` when none was proposed). The subagent that carries a part
gets both lists in its kickoff and, once the plan runs, gives the part its
state, matched by order.

Parts run in **waves**, never two on the same file at once. Each part has a
stable `id` (`part-1`, `part-2` by order when the planner names none) and an
optional `after` list. `planClusterWaves` (`packages/core/src/clusters`) builds
the waves:

- Two parts overlap when a `touches` entry equals the other's or is a folder
  that holds it. The earlier part goes first.
- A part starts only when the parts it overlaps and the parts in its `after`
  finished. A part with no `touches` touches everything and runs alone.
- An `after` with an unknown id, the part itself, a cycle or repeated ids is
  dropped as a whole, the waves come from `touches` alone, and the plan page
  says so.
- `readyClusterIndexes` starts the first wave at fan-out, then every part whose
  blockers just finished.
- A part started by hand while an overlapping part still runs waits and names it
  (`agentWriterWait` with `blockedPart`; **Cancel** ends the wait).

The planner prompt asks for disjoint `touches` on parallel parts, shared edits
(route tables, config, shared types) in a first part the others come after, and
a folder only when it belongs to one part.

When waves matter, the plan page groups parts under **Runs first** and **Then**,
with **, in parallel** for a wave of several (`PlanParts`, `planPartOrder`,
`hasWaveGroups`), names each shared file and the order it forces, and says why
the planner's order was dropped. A plain chain stays a flat list. On the run,
each part's subagent shows its wave (`waveLabelsOf`, `RunTree`).

### Comments on a plan

You change a plan with **comments** on the plan document. A comment points at a
part (`kind: part`), at a heading, list item or paragraph (`block`), or at a
selected phrase (`quote`). Anchors match by text, so a moved block still finds
its comment, and one whose text is gone sits in a group under the text.

Comments live in `artifact_comments` (m224): `draft` until sent, `sent` with the
turn id, then `addressed` when the text it pointed at changed in the new
version, or `open` when it did not.

**Send to planner** is one operator turn on the agent that wrote the plan
(`plan.agentId`, through `sendTurn`, never the resolve queue):

1. It asks "Please revise the plan:", lists each comment in plan order with its
   anchor and quoted text, and asks for the whole updated plan.
2. A turn that settles with a new revision annotates it with the ask and the
   anchors, and settles each comment.
3. A turn with no new revision puts the comments back to `open` ("No new version
   in this turn").
4. A `sent` comment found after a restart is settled the same way once the
   planner is idle.

Send is refused, with its reason, when the planner is gone or working, the plan
was consumed or replaced, or a later step of its workflow run left `pending`. A
run held for plan approval is the exception, since it does not advance
(`workflowPlanApproval.ts`), and the bar offers **Approve** beside Send.
Comments are removed with their artifact.

## Wireframes

A wireframe opens on its **Flow**: the graph of its screens, a one line legend
(`next`, `back`, `same screen`, told apart by line style and glyph, never by
colour) and a grid of page previews. A node or a tile opens **Screens**: a rail,
the real page in its device frame with Fit or 100% zoom, and a **Notes** panel
with the screen note and the numbered notes of its nodes.

The pages are the saved copy's own, shown in an isolated frame
([../architecture.md](../architecture.md#frames)); links inside them work, and
**Open in browser** opens the screen in view, or the index from the Flow.

**Save a copy to…** (under `⋯`, beside **Copy spec**) writes a folder you pick:
`index.html`, one page per screen under `screens/`, `wireframe.css`, the
validated `wireframe.json` and `wireframe.schema.json` (from
`buildWireframeJsonSchema`), a `README.md` with a rebuild prompt, and
`meta.json`. The pages hold no script and no inline style, and Goodboy never
reads that folder back.

### The spec

The spec is version 2. It can define **patterns** once and reuse them
(`{ "use": "posting-row", "with": { ... } }`), give a screen up to 4 **states**
(sets of nodes to hide, show or retext), cut release **variants** with `only`,
set the **device** (desktop, tablet or phone), and use the kinds card, tabs,
badge, toggle, sheet and chart. A note on a node becomes a numbered marker. A
version 1 spec is upgraded on read, its `mockState` toggles becoming states.
Every revision keeps who made it, what was asked and the nodes picked, and the
saved copy holds one folder per version.

### Changes and versions

You change a wireframe from **Screens**, not from a chat:

1. **Ask for a change** takes a request. **Pick** turns a click on an element
   into a chip, with the scope **This screen** or **All screens**.
2. ⌘↵ sends the spec, the request, the picked node ids and the scope to the
   agent that drew it. The pill reads `v4 · Drafting`, and the stage stays on
   the current version.
3. A version that lands takes the request as its label. A spec that fails the
   checks is **not kept**: a warning says why, the request stays, and **Ask
   again** resends it.

The version pill opens every version with **View**, **Compare** and **Restore**.
Viewing an older one says so above the stage. Restore writes the old version back as `Restored vN`, with its own title, text
and metadata, and only on top of the version you were viewing: if a newer one
arrived meanwhile, nothing is written and the message says "A newer version
arrived. Review it before restoring."

**Compare** puts two versions side by side, with the diff computed from the specs
by node id, never from the HTML. The rail marks each screen Added, Changed,
Removed or Same; the pages outline added (`+`), changed (dashed `~`) and removed
(`−`) nodes; a **Changes** list says it in words. A node that kept its kind,
text and place under a new id counts as changed. A landed version offers `N
changes · Compare` for 10 seconds.

### Import

**Import wireframe JSON…** on the Artifacts page (from **New artifact ▾**, or
**Artifact files** once the session has some, or a dropped `.json`) and
**Replace spec with JSON…** in a wireframe's versions popover bring a spec in.
The validator answers inline, never in a dialog: what it adjusted, with **Import
anyway** and **Cancel**, or why the file cannot be read. An import gets an idle
Wireframe agent that owns it, and its version reads `Imported JSON`.

## Markers

- Plans sit between `<<plan>>` and `<</plan>>` markers
  (`packages/core/src/context/marker-parsing.ts`).
- Reports and wireframes sit inside an `<<artifact v=1 kind=...>>` envelope: a
  JSON header line with title, format and metadata, then raw content up to
  `<</artifact>>`, so markdown is never escaped into a JSON string.
- The parser still reads the older single JSON object body, repairing raw
  newlines, stray and smart quotes, and a block in a plain or `json` code fence
  (`packages/core/src/artifacts/envelopeBody.ts`,
  `packages/core/src/artifacts/locateArtifactBlocks.ts`).
- The transcript hides that block, fence lines included: `splitArtifactText`
  falls back to `locateArtifactSpans` when the strict scan finds none, only for a
  block that reached its close line, so a quoted open marker stays text.

Kinds, statuses and metadata are typed in `packages/types/src/artifact.ts`
(`ArtifactKind`: `plan`, `report`, `wireframe`).
