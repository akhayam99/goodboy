# The Checks and Work tabs

> **Read this when** you change the Checks tab or the Work tab of the Branch page, a check agent on its row, the Leads block or how a run opened from Work comes back. **Not for** the header step that starts a check fix ([branch-page.md](branch-page.md#the-one-step)) or the session's own Runs page ([lens-surfaces.md](lens-surfaces.md#runs)).

## Checks

The checks of the pull request.

- **Before any agent**, a failing GitHub Actions row reads its log in place
  (`CheckLogInline` over the `readCheckLog` store action), the first failing check
  open on arrival, with Open on GitHub for the full log. A check of another service
  still opens on its host.
- **A check agent works on its check row** (`AnalyzedCheckWork`). Its result stays
  there with one button (`Review fix`, `Push`, `Retry` or `Analyze again`, from
  `checkRowResultOf`), and the Checks tab carries a live dot on every tab
  (`checkTabLiveOf`). One agent works per branch
  ([branch-page.md](branch-page.md#every-verb-does-the-work-where-you-stand)).
- **Other hosts.** A GitLab or Bitbucket session reads its checks through the same
  five states once its host's `canReadChecks` is on (GitLab: the jobs of the head
  pipeline, a job allowed to fail counts as skipped; Bitbucket: its commit
  statuses). A token that cannot read pipelines gets the denied notice with `Open
GitLab in Connections`. While it is off the tab says Goodboy does not show that
  host's checks yet (`checksViewOf`).

## Work

The last tab holds what Goodboy did on the branch: `Runs`, `Questions` and
`Artifacts`, each the branch group the session page draws for this mount
(`branchGroupKeyOfMount`), with the same rows, folds (`N finished`, `N answered`,
`N used`) and counts, so the two can never disagree.

- A fold owns its count: while a group folds, its header summary leaves the
  finished out, so `1 finished` reads once.
- A section with nothing for the branch is left out; with nothing at all the tab
  says so.

### Leads

On a branch with an Auto run the tab opens with a story line and a `Leads` block
(`BranchWorkLeads`, over `branchLeadsOf`): one line per Lead (glyph, `Auto`,
title, state word, spend on this branch, and `also on` naming each other branch it
worked on), with the compact `LeadTree` of the agents it ran here.

- The line opens the Lead page and has no button of its own; its `Back` leads to
  this tab.
- The Lead leaves the `Runs` group, which is then headed `Earlier runs`. A branch
  with no Auto run renders as before.

### Layout

The three sections are groups of one `ListGrid` with the runs' columns
(`RUNS_GRID_COLUMNS`). Question rows and artifact rows (`ArtifactWorkRow`,
`ArtifactWorkGroup`) fill the same keys through `cells.byKey`, so the section
icons, the row titles, the state words (`Needs you`, `Ready`) and the times share
one x, and the gaps between sections are the grid's `gap-y-8`.

- Runs and questions reuse the session page's group (`RunsByBranch`,
  `QuestionsByBranch`), all three with a `heading` in place of the branch name: its
  icon, its name and `All runs`, `All questions` or `All artifacts`, which open the
  session page on that group without touching its By branch or By state switch
  (`openBranchWork`).

### The count

The tab count reads `branchWorkCountsOf`, which still counts the Lead as a run, so
it equals what the board cell of the same branch reads.

- In warning: the runs that need you, the questions that wait for you and the
  artifacts that need you, each wait counted once. A question or artifact whose
  agent belongs to a run that needs you, or whose asker already counts, is the
  same wait, and the tooltip names it: `1 run needs you with 1 question`, from
  `held`.
- Else the runs working (info).
- Else the runs, questions and artifacts of the branch together.
- All from the session pages' branch group of the mount, read once the questions
  and artifacts loaded, so the badge never climbs while they arrive.

### One registration

The tab body comes from one registration module of the session feature,
`branchWorkTabRegistration` (`useWork` and `render`, typed by
`BranchWorkTabRegistration` in `features/branch/branchWorkTab.ts`), which
`useBranchTabFacts` and `BranchWorkBody` import directly. The artifacts section
comes the same way from `branchWorkArtifactsRegistration`.

- The tab is always available: a missing registration is a build error, not a
  state the page handles. Past that module the Runs tab adds no import of the
  session feature's components or hooks.
- `useBranchTabFacts` reads it once per page for the badge and the body. Until the
  questions and the artifacts are read the body is a skeleton, and for artifacts
  also until every provenance read has answered (`useArtifactBranchItems`
  `isSettled`).

### Leaving and coming back

- A run, an agent or an artifact opened from Work, by a row or by a row menu
  action, marks the new history entry with `Focus.runGroup`
  (`useMarkBranchWorkLeave`, written on the entry as it lands, not through
  `amendFocus`, which would sync that entry to the page still showing). So its
  parent crumb and Esc lead to this tab (`parentPlace`), even after Back from a
  child agent.
- Under By state the Artifacts page reveals the arrived branch only once every
  provenance read has answered (`useGroupArrival` waits for `isSettled`).
- A question opens its drawer over the Questions page, whose `Close` goes back
  here.
- Back also reopens the fold that held the row you left and scrolls to it
  (`useRowReturn`: `N finished`, `N archived`, `N answered`, `N used`).

### Other branches

- `Also on` on a row opens the Runs tab of the other branch.
- `Open branch` on Runs, Questions and Artifacts, and a run's branch chip, land on
  Runs (`openBranchWorkTab`), on the path the Branch page knows for that mount id
  (`sessionProjectMounts`), so a row with no worktree path never opens the fallback
  branch. A group, chip or series row whose mount the page does not know draws no
  `Open branch` (`useCanOpenBranchWork`, `branchPageMountOf`).
- The Projects tree draws no Work mark yet (`worktreeEntryFactsOf` gives Work no
  fact): the tree reads no runs or questions per row.
- The Monitoring entry for the branch has no slot yet: it joins as a fourth section
  once Monitoring takes a branch target.
