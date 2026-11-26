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

`Trail` can still give a segment a menu (`menu`, a `CrumbMenuModel` drawn by
`CrumbMenuTrigger`), but no trail in the app passes one today. Session crumbs
carry no segment menu ([session-rail.md](session-rail.md#crumbs)), and the
session page counts live with the page tabs
([session-rail.md](session-rail.md#counts-and-the-current-sign)).

When a segment gets a menu, the primitive keeps these rules:

- A menu with fewer than two entries (rows plus actions) is dropped, and the
  segment stays a plain crumb with no chevron (`crumbMenuWithChoice`).
- A filter appears from nine rows up when the menu names a filter placeholder.
- Widths are 320 (`narrow`), 380 (`regular`) and 460 (`wide`).
- An action that breaks something confirms inside the menu's action band with
  `InlineConfirm`.
