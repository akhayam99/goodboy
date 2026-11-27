# Help: the Guide and What's new

> **Read this when** you change the Help page, the Guide, its chapters and the links that open one, or the What's new reader. **Not for** the signature that opens What's new ([shell.md](shell.md#the-rail-foot)) or release notes themselves ([release.md](../release.md)).

**Help** is one page (`app/components/HelpStudio`) with two tabs, Guide and
What's new, and one search (`RailSearch`, "Search help") over both: a result
opens its tab and its chapter or release.

- A tab is a studio kind, `guide` or `changelog`, so switching tabs is a
  `switchStudio` and the tab you read is the history entry. The band title reads
  "Guide" or "What's new".
- The band holds `Back to app` with the Esc chip at the top left and there is no
  Close (`close: 'back'`, pinned by `StudioFrame/index.test.tsx`). Its one other
  control is "Sponsor on GitHub", which leaves the app (`SponsorLink`): beside
  Back to app, or, when Help takes the whole window on Workspaces, at the end of the
  title row (`DetachedStudio`).
- Help in the menu bar and the palette open it on the Guide, and the palette
  rows open either tab. No rail mark is lit while a Help tab is open.
- **The Guide** shows one chapter per page on the `guideChapter` reader frame,
  with Previous and Next. The Help search (`shared/components/RailSearch.tsx`)
  lists chapters and points; Enter opens the first hit and flashes its point,
  Escape clears it.
- Three links open the Guide on a chapter and Back returns: the session hover
  card's "What do these marks mean?" (Legend), Impact's Spend tab "How cost is
  counted" (Tokens and cost) and the Storage worktree row's "What is a
  worktree?" (Words). They share `features/settings/openGuideChapter.ts`. An id
  the Guide no longer has opens What is Goodboy; a renamed chapter keeps its old
  id as an alias in `resolveGuideChapter.ts`.
- The chapter "Listens" holds one table of prefixes (`PrefixTable`, read from
  `quick-actions/grammar.ts`). The chapter "Rail, Sessions and session pages"
  restates this shell in `guideChapters.ts`, and `guideChapters.test.ts` pins
  its names against `COLUMN_DOORS`, the page registry and `NEW_DRAWER_FORMS`,
  and pins the word budget. The Legend draws its session marks through
  `sessionNodeOf`, so a new mark appears there without a second table. The
  addresses live in `shared/lib/productLinks.ts`.
- **What's new** is a rail of releases grouped by minor, with an Older group
  below 0.4 (`ChangelogRail`), and a reader beside it. `CatchUpReader`
  (`page="whatsNew"`) opens first and sums up everything since the version you
  last read; `ReleaseReader` (`page="release"`) shows one release. A release that
  is the pending update shows `UpdateActions`, the same verbs as the update card,
  and never a confirm of its own.
