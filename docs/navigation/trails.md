# Studio trails and segment menus

> **Read this when** you change the trail in a studio band, how it compacts, or a crumb segment menu. **Not for** the session crumbs, which are plain links ([session-rail.md](session-rail.md#crumbs)).

## Studio trails

- **Studios use the `Trail` primitive.** The `StudioFrame` band renders the studio
  name through `Trail` from `@goodboy/ui`. A body that goes deeper claims the band
  with `StudioTrail` (the workflow editor shows `Workflows > Ship a fix` with its
  save state and actions). A session page has no studio trail.
- In a split studio (Chat, Guide, What's new, Tasks, Notifications) the band is
  the first child of the detail beside the page rail, not a bar across it, so the
  crumb, the title and the body share one x
  ([frame map](../styling.md#the-frame-map)).
- **The parent crumb is Up, and the last crumb names the kind.** No crumb carries a
  back glyph, and `Trail` has no lead slot (`no-back-glyph-in-trail.test.tsx`).
- **Depth compacts the trail.** Every crumb has an icon. The last crumb and its
  parent stay full, and the first keeps its name through five crumbs. From five
  every other ancestor becomes an icon, from six the first crumb too. Still no
  room: ancestors turn to icons from the left, then the icons after the first
  crumb fold into a `…` menu; the first crumb never folds. An icon crumb keeps its
  name as tooltip and accessible name.
- `compactTrail` in `@goodboy/ui` is the pure rule. A label closes with a 220ms
  width transition (120ms fade), and a new crumb enters from the right 60ms later;
  under reduced motion only the opacity changes.
- **A crumb carries no status dot.** An agent's state is drawn once in the row
  node and once in the agent header chip, whose tooltip (`stateDescription`) is
  the one place that explains the state words. Elapsed time shows only in the
  header. The Brief's Now band keeps the label and the "much longer" note.
- **A resolver title names the flow verb**: `Resolve: index.ts comment` for the
  maintainer's own comment, `Resolve: Mara Quint on index.ts` for another
  reviewer, `Resolve: 3 review comments` for a group. Rows saved with the
  lowercase `resolve: ` prefix show without it (`agentDisplayName` in
  `shared/utils`).
- **An integration page hangs off its own tool**, with its crumb named after the
  tool (GitHub, GitLab, Jira, Linear, Slack).
- **Settings** picks its scope from its own scopes rail, not from a crumb
  ([settings.md](settings.md#a-page-with-its-own-scopes-rail)); providers and
  integrations live in Connections ([connections.md](connections.md)). The first segment of a studio has no menu, since studios
  change from the column, and is a button only when the studio has a start to
  return to.

## Segment menus

`CrumbMenu` stays in `Trail` and comes back per segment where a switch is missed.
Its menu lists the siblings of what the segment names, plus at most two actions
of that thing. A segment whose menu would hold fewer than two entries is a plain
crumb with no chevron.

- **The page segment** (depth one, or `Session` when alone) lists the session's
  pages, grouped as pages, Tools and Linked, each with a count from one pure
  table, `pageCountWordOf` (`features/session/pageCountWord.ts`), noun last and
  empty at zero:
  - Branch: `3 branches` with more than one mount and no diff, else `5 need you`,
    else the one mount's branch name with its `+x -y` diff on the open session's
    row only (a review note is not a branch fact);
  - Runs `2 running` in the info tone (else `4 runs`), Agents `1 running` (else
    `3 agents`), Artifacts `4 artifacts`, Questions `2 open`.
  - The page tabs and the menu read it through `pageSlotOf`
    (`features/session/pageSlot.ts`). `Session` has no menu once it has children.
- **Siblings.** A run lists the session's runs (Running, Finished, a chained run
  indented with `after ...`); a step lists every step of its run, the ones not
  started switched off; an agent lists the agents of the same home grouped Needs
  you, Running, Done, newest first; an artifact lists the artifacts by kind.
- **Actions** exist only where a real action backs them: `Start a run` and `New
artifact` (the kind picker) on their pages, `Stop this step` while a step runs,
  `Retry step` when it failed or is blocked (`recoverStuckStep`), `Show saved
copy` and `Copy folder path` on the open artifact, and `Resolve again` on an
  attempt once none on that comment is queued or running (`useResolveAgain`, as
  on the Comments tab).
- **Five slots per row**: lead, label with a faint second part, meta, a state
  that is always a word (the reading the Runs list makes in `sessionRunsOf`), and
  a check on the current row, even when it is the only row.
- **Chevrons.** The last segment opens its menu from the whole segment and always
  shows the chevron. An ancestor goes up by its name and opens its menu from a
  faint, always visible chevron that doubles as the separator, so the gaps are
  equal. Name and chevron light up as one chip on hover.
- Page icons take the tone of their concept (linked tools keep their brand
  colour). Widths are 300 (pages, scopes, sections), 380 (runs, steps, agents,
  artifacts, conversations, attempts) and 460 (branches); a filter appears from
  nine rows up.
- An action that breaks something (Stop this step) confirms inside the menu's
  action band with `InlineConfirm`; Escape cancels the confirm first. Shortcuts
  live in the segment tooltip and the palette, never in the rows.
