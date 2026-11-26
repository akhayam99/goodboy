# The Conversation tab

> **Read this when** you change the Conversation tab of the Branch page: the merge box, the side column, the description, the Activity, the branch start page or the create pull request form, on any host. **Not for** the header step ([branch-page.md](branch-page.md#the-one-step)) or the Comments tab ([branch-comments.md](branch-comments.md)).

The pull request itself, on the 960px column
(`features/branch/components/PullRequestTab`): the merge box, then the reading column
(description and Activity, at most `max-w-prose`) beside a 224px side column, which
moves above as one wrapping row below an 880px page container.

## The merge box

`MergeBox` (every word and count from `mergeBoxOf`) answers "can this merge?" from
the merge action's readiness result (`evaluatePrMergeReadiness`,
[branch-page.md](branch-page.md#merge-readiness)).

- It waits only when running checks or a required review are the sole blockers; a
  blocker readiness names (`Checks unknown.`) outranks waiting, and the checks it
  knows stay visible while the runs load.
- A reviewer asked but not required, with no `review_required` decision, shows as
  `Waiting on dana-r` with `Not required to merge`, never as the verdict.
- It never holds a button that acts; the header keeps the one primary. A merged or
  closed pull request keeps the verdict alone.

**The verdict**: `Not ready to merge` with the next two steps in the header's order
(`Answer omar-t, then fix the failing check.`: the first two entries of
`branchStepsOf`, whose first entry is the header's step, worded by
`verdictStepTextOf`; a draft whose first step is not `markReady` names them too),
`Waiting for checks`, `Waiting for a review`, `Checking`, `Ready to merge` with what
the header button does (`Squash and merge into main. Nothing is waiting.`), `Draft`,
`Queued to merge` with the queue line, `Merged into main` or `Closed without
merging`.

**The rows** under it, one per thing that holds the merge, worst first (danger,
warning, info, neutral), each opening where it is fixed:

| Row       | Reads                                                                                                         | Opens                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| checks    | `1 check failing` with names, `Checks running, 2 of 3 done` (`checksCountsOf`, as the rail), `Checks unknown` | Checks                                                         |
| conflicts | conflicts with the base                                                                                       | Changes                                                        |
| push      | commits not pushed                                                                                            | Commits                                                        |
| review    | `Changes requested by omar-t` with the `openThreadsLineOf` line, `Waiting on dana-r`, `No approval yet`       | the reviewer picker when nobody was asked and the host can ask |
| threads   | `2 threads need you`, then `5 open threads · 1 unread`                                                        | Comments                                                       |
| branch    | `Rebasing onto main`, `Diverged from the online branch`, `3 commits behind main`                              | Commits                                                        |

Everything that passes (`7 checks passed`, `No conflicts`, `Approved by kenji-w`,
`Up to date with main`) folds into one quiet line that opens in place.

## The side column

`PullRequestProperties`, read from the branch on screen:

- **Reviewers**: people only, the asked ones first, each verdict after the name
  (`Asked`, `Changes`, `Approved`); `+` opens a picker over the host's
  collaborators. A short skeleton shows until they are read, never `Nobody asked
yet` before.
- **Bots**: every bot apart, whatever its verdict (`pullRequestReviewerGroupsOf` in
  core), each with one word from `botWordOf`: `1 issue` for the open threads it
  started among the queue's threads (the host thread heads until the queue loads),
  `2 resolved`, or its review state. A bot is known by the host's author type
  (`isBotLogin`, [hosts.md](../hosts.md)); the `[bot]`, `-bot` or `_bot` suffix
  applies only when the host gives no type, so a user named `northwind-bot` stays a
  reviewer. One author is one kind in every row.
- **Checks** `4 passed · 1 failing` (`Checks unknown` on a failed read); **Linked
  issues** with their relation (`Closes #412`; `Link issue` opens the popover);
  **Author**. No Rebase.

## The description

- Markdown with `Edit` beside its heading, folded after five lines behind `Show all`
  (`DescriptionFold`; focus on a link under the fold opens it).
- The body's headings read as bold lead-ins, and a first heading repeating
  `Description` is dropped (`demoteBodyHeadings`). A code fence closes only on the
  same character, at least as long and with nothing after, as CommonMark says, and
  an unclosed fence runs to the end, so a heading in code stays literal. The edit
  preview keeps headings as written.
- A click on the text opens the editor too: a textarea with Write and Preview, `Save`
  and `Cancel` at its end; a failure keeps the draft with Retry. An empty description
  reads `No description yet` with `Add description`.

## The Activity

Oldest first: who opened it; the pushes (one author's pushes in a row fold into one
row with the commit count, `foldPushes`); the reviews; one comments line, `4 open
threads on files, 2 need you` (or `All threads on files resolved`), opening Comments;
one checks line opening Checks; your edits of this session and the merge. While the
view loads, three `PullRequestActivitySkeleton` rows behind `SkeletonSwap` (nothing
for 120 ms, then at least 160 ms).

- **One count of threads.** The comments line's and the merge box's open and need-you
  counts are one number each, read once in `PullRequestPage` from
  `pullRequestThreadCountsOf`, and each review app's `issue` count reads the same
  entries ([branch-comments.md](branch-comments.md#one-function-per-number)). A
  thread left open on the host counts as open; a host thread outside the queue never
  adds one, nor does a local note.
- The merge box row reads `6 open threads · 1 needs you · 2 unread` under a review
  that asked for changes, each part after the first hidden at 0
  (`openThreadsLineOf`). The unread part comes from `unreadThreadsOf` over the
  selected source's threads not yet seen in Comments, hidden until the reads and your
  host name load.
- **Review apps** get one row with their `botWordOf` verdict (`1 issue`, `3
resolved`) and summaries folded behind `Show summary` (`groupBotActivity`); a
  bot's approval stays its own review row.
- **Filters** `All`, `People`, `Bots`, `Pushes` and `Checks` carry the counts
  `activityFilterOptionsOf` gives, and an empty one is hidden. The comments line sits
  under `People` when a person left a finding, never under `Bots`, which counts only
  the review apps' rows. On GitLab and Bitbucket with no detail loaded the line is
  built from the loaded host threads (`hostCommentsOf`) under `People`; GitHub shows
  none until its detail loads. The choice belongs to the pull request: it survives a
  visit to Comments and a reload, and another request starts on `All`
  (`activityFilter` on the `pullRequestViews` entry).
- Faces and quiet nodes (`ActivityLeadMark`, `WorkNode look="quiet"`: failing checks
  on the solid danger node, threads that need you on the solid amber one, passing
  checks a bare check, the rest neutral) sit on a 1px `border-soft` spine; ages sit in
  the `ActivityMeta` column; rows that open something carry `ROW_INTERACTIVE`.

## Without a pull request

The section is the branch page (`BranchStartPage`): no merge box and no summary. Its
line (`branchStartLineOf`) names the branch with `3 not pushed`, `Up to date with
origin`, `Diverged` (warning, when origin has commits the branch lacks) or
`Rebasing`; adds `3 behind main` only when the base moved; and adds `Pre-push hook
passed` or `Pre-push hook declined` with its age once this machine pushed, a pass
only while nothing waits to be pushed.

The hook result comes from the push result, the repo's pre-push hook being the one
local gate, kept in memory per mount (`local-checks` slice, `mountLocalChecks`), so
after a restart the line says nothing until the next push. A push that went through
counts as passed, hook or not; a failure that does not name `pre-push` keeps the last
result, a remote `pre-receive hook declined` included (`localCheckOf`).

## The create form

Prefilled from the branch (`pullRequestPrefillOf`): one commit gives its headline;
several give the linked issue and the first headline, the description listing the
others (never a `fixup!`, `squash!` or `amend!` one, nor the headline's); `Closes
HL-1372` for a Linear issue. `Into` starts on the mount's base (`defaultBase`), the
host default filling it only when empty.

- **It works on the branch on screen**: that mount's status and base branches, never
  the session's write destination. On GitLab `CreateMrForm` takes the same mount and
  prefill and hands the mount to `createMrForSession`.
- **Its submit is the tab's one primary**, as `Push and create pull request` while
  commits are not on origin; while it leads, the header's push waits in `⋯` and any
  other header step steps down (`isFormLeading`). While the branch is behind, the
  header's Rebase leads and the submit is secondary.
- On a diverged branch the submit reads `Force push and create pull request`: it
  opens the Push action's confirm (`forcePushConfirm`, listing the commits that exist
  only online), then force pushes with lease and opens the request
  (`createPrForSession` with `forcePush`); a plain push is never tried there.
- While a rebase is stopped the form waits and lists the conflicting files; a branch
  with no commit of its own shows `No commits on this branch yet`.
- **Layout.** One input card (the title as a large borderless field, the
  description growing from 6 to 16 lines, `Write with Scribe` with its routing and a
  faint `Markdown` in the bottom row); the settings as properties in the side column
  (`Into`; `Opens as` with `Ready for review | Draft` only where the host sets
  drafts; `Reviewers` only where it can request them, asked right after creation;
  `Closes` with the linked issues; the changelog entry under `More options` when
  Scribe wrote one); the actions inline at the end, right aligned: `Discard text`
  (with Undo) and `Create pull request`, or `Create draft pull request` with Draft.
- Scribe's job shows in the card: skeleton lines while it writes, a running dot with
  the seconds and `Stop`, a danger notice with `Retry` on failure. Creating shows
  `Pushed <branch>` and `Opening the pull request` in the same row; a failure keeps
  the text under a danger notice with `Details`. A `Follow` toast ("Pull request #318
  opened") shows only when the page is not on screen.

## Hosts

Every write goes through the host-neutral `PullRequestPort`
(`packages/core/src/review-source`), built per host in
`store/slices/review-source/pullRequestPortFor.ts`; the page reads the capability
table (`REVIEW_SOURCE_CAPABILITIES`), never the host. A control the host forbids on
an existing object is disabled with its reason (`Bitbucket has no draft pull
requests`, `Turned off in payments-api`, `Set by the project`); a concept the host
lacks is left out.

- **GitLab** uses the same page with its own calls and words (`merge request`, `MR
!42`, `Open on GitLab`). `gitlabPullRequestPort` goes through Tauri commands that
  hold the stored token. `Mark ready` and `Convert to draft` change the title's
  `Draft:` prefix, Merge lists the project's allowed ways, and a token without the
  `api` scope reads `Goodboy can't read this merge request` with `Open GitLab in
Connections`. A branch with no merge request gets the same form with `Create merge
request`, the same Scribe job and no reviewers.
- **Bitbucket** uses its own adapter (`bitbucketPullRequestPort`, built by
  `bitbucketPortOf` from the mount's request): merge offers three strategies, `Close`
  declines, and the draft and reopen controls are left out.
