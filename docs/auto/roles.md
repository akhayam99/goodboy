# Which role the Lead picks

> **Read this when** you change how a Lead chooses a role for a child: the
> routing table and the role rows in its prompt, the role fit check, the
> Scribe and the Rewriter, what a read-only role may be asked to run, or the
> branch facts a scout gets. **Not for** what a role is
> ([concepts.md](../concepts.md)) or which provider a child runs on
> ([providers.md](providers.md)).

## Prompt rules

These are prompt rules: a test proves the prompt holds each row, not that the
model follows it. Role fit and the shell check are what the code enforces.

### WHICH ROLE FOR WHICH WORK

The system prompt (`packages/core/src/auto/prompt.ts`) carries the role list and
a routing table generated from `AUTO_ROLE_WHEN`, one line per Auto role, so no
role joins without one: diagnosing a failure to an Investigator, tests to a
Tester, text about code to Docs, code changes to an Implementer when no narrower
role fits, the pull request to a Scribe, a failing check to a CI fixer, the
branch's commit history to a Rewriter. It names a child's `mount` field and the
MOUNTS line it comes from.

Auto never reads code: a question that needs it goes to a Scout
([the Lead's tools](../auto.md#the-leads-model-and-tools)). When it says what
happens next it names the hand over and the role ("I asked an implementer to
reinstall the dependencies"), never an action of its own.

### WHEN TO ADD A ROLE

After the table the prompt renders **WHEN TO ADD A ROLE** from
`packages/core/src/roleNeeds.ts` (`roleNeedsSection`, driver `auto`): per role a
trigger and a "do not add it when". Auto picks the narrowest row whose trigger
it sees in the goal or a result: history words for a Rewriter, a red check for a
CI fixer, a pull request for a Scribe, a behavior with no test or a regression
for a Tester, README, docs or changelog for Docs.

- The Implementer row is last, the fallback. It also takes a check that must run
  commands and changes nothing while no reading role has git.
- A "do not" beats a reason, and a force push always brings a reviewer.
- The rewriter, scribe, CI fixer and implementer rows are Auto's only; the
  investigator row sends a red check to a CI fixer (`autoDoNot`). The
  Orchestrated prompt renders the table filtered to its roles
  ([workflows.md](../workflows.md) → Step sequencing).
- "Decide once before you fan out": when two or more writers would get the same
  task on different branches, one writer or a planner decides first.

### Dependencies in the brief

Every writer brief carries `AUTO_DEPENDENCIES_RULE`: install missing
dependencies with the project's package manager in its own mount, never link or
copy `node_modules` from another checkout. When the dependencies row asks, the
launch guard adds its section after it
([launch-guard.md](launch-guard.md#the-brief-and-the-ask)).

## Role fit

One row is enforced. `resolveDelegateChild` scans the title and task of a new
Implementer child with `roleFitOf` (`packages/core/src/auto/roleFit.ts`), a
linear word scan with no backtracking pattern.

- History words, a red or failing check and a pull request to write or open
  count anywhere.
- Tests and docs count only in the title or the first work item (up to the first
  sentence end, semicolon, "then", or comma after three words), so "then add
  tests and update the docs" stays with the Implementer. A path under `docs/`,
  `README.md` or `CHANGELOG.md` is a docs word.
- A word after no, not, never or don't in the same clause (six words back, cut at
  but, then or instead) does not count, except "no regression test".

When a narrower role fits, the batch is refused `role_narrower` and nothing is
written; the message tells Auto to send it to that role or keep the implementer
with a one line `roleReason`.

- A resend with `roleReason` passes. Admission stores `roleFit` and `roleReason`
  in `request_json`, and the child page shows "Why not Tester: <reason>"
  (`roleKept` in `delegationCardOf`, `AutoChildBrief`).
- A retry, a continue and a revise keep their role and are never scanned; a retry
  and a continue copy `roleFit` and `roleReason`.
- While Auto cannot start a Rewriter (`AUTO_CLOSED_ROLES` in `roles.ts`), history
  work fits the Implementer.

## Scribe and Rewriter

Scribe, CI fixer and Rewriter are writers (m232 widens the role CHECK of
`auto_delegations`; Rust `WRITER_ROLES` holds them).

A Rewriter cannot start: its turn needs the copy the History flow prepares
(`leaseTurnWriter` throws without a `historyRewriters` binding). So
`resolveDelegateChild` refuses it `spec_invalid` before any agent exists and
tells Auto to use an Implementer with `publish: {mode: "force"}`. Goodboy checks
the tree, keeps a backup and asks you to confirm the force push; it does not
check each rewritten commit ([pushing.md](pushing.md#a-force-push)).

A Scribe writes `<<pr-title>>` and `<<pr-body>>` and never runs gh. When it ends
completed, `finishAttempt` calls the `publishScribePullRequest` port, through
`resumeScribePullRequest` and `openScribePullRequest`, the Branch page's path
(draft, the repository's base, never a second request on a branch that has one).

- Auto reads "Pull request #421 is open: <url>".
- A failure fails the delegation with `createPrFailureText`, a sentence the
  person can act on, shown with Retry (`delegationReasonTextOf` lets it through
  because it starts with a capital). A retry opens it once.
- The base is a branch name from `requestBaseBranchOf`, so a mount storing
  `origin/main` opens against `main`.
- The push and pull request rows can hold it ([publish.md](publish.md)).

## Read-only roles and commands

Only a writer has a shell. Scout, Planner, Investigator and Reviewer run with
`Read,Grep,Glob` (`READ_ONLY_ROLES` in `cli_args.rs`).
`packages/core/src/auto/roleTools.ts` holds that fact for Auto: each role line
says whether it has a shell, and a task that runs a command goes only to one
that does.

`resolveDelegateChild` enforces it through `autoShellRefusalOf`. A read-only
role whose task, done-when or expected output names a command (`git log`,
`pnpm test`, `git -C`, `npx`, "run the tests", "verify the tests pass", a range
such as `a1b2c3d4e..HEAD`, or an output only git gives, such as a trailer or
whether the remote branch exists) is refused `role_lacks_shell`, and nothing is
written. "make sure" and "make the change" are not commands; `make all` in
backticks or after "run" is. The message lists
the roles that run commands (`AUTO_COMMAND_ROLES`: never a closed role, never
the scribe) and quotes the match (`commandMentionOf`). A revise is not checked.

- A command inside a prohibition does not count: no, never, not, don't, without,
  skip or avoid (and `non`, `senza`, `mai`) within six words before it in the
  same clause. "never run git push" passes for a planner.
- A clause ends at `.`, `!`, `?`, `;`, `:`, a new line, "but", "then", "instead",
  or a comma followed by "run" or "execute", so "Do not run git log, run pnpm
  test" counts `pnpm test`. The scan is a linear walk.

There is no read-only shell role yet: a read-only check goes to a writer with
"read only, change nothing" in the task. A child that returns with
`needs="shell"` or `needs="writer"` gets `needs_shell` or `needs_writer`, and its
result tells Auto to hand the same task once to a role that can. A closing with
no `needs` (an old CLI) that says in English it had no shell tool reads
`needs_shell` too (`isMissingShellText`). The reroute is Auto's own next hand
over, checked by the same refusal.

## Branch facts for a scout

A scout cannot run `git log` or `gh pr view`, and a shell for a read-only role
would give the Auto root one too (they share the tool policy). So a scout spec
may carry `"facts":["<mount id>"]`, up to `AUTO_FACTS_MOUNTS_MAX` (4). A question
about a pull request's state goes to a scout, never a writer, and the
`role_lacks_shell` message says so.

`resolveDelegateChild` calls `gatherBranchFacts` before the kickoff. Per mount
the `readBranchFacts` port reads the commits since the base, the pull or merge
request, its open review threads and its checks, on GitHub, GitLab and Bitbucket
(`makeBranchFactsReaders`, through `pullRequestPortFor` and the review source
threads, as the Branch page does). Each reader resolves the mount it is asked
about, never the active one: the host from `mountRequestHostOf`, the request
stored for that `mountId` (`mountGithub`, or `mountRequests`), the GitHub
threads from that mount's detail (`refreshSessionPrDetail`, checked against the
request number).

- No request reads "none is open". A request or detail not read reads "Facts not
  available: reason", never "none", and the scout still starts.
- The request line carries the host's head commit (`headSha` of the live
  `PullRequestView`) and the checks in the Branch page's words (`checksWordOf`: "2 failing", "1 running", "none reported", or "not read" when
  the host did not answer).
  The checks line says it is not matched to that commit, since a push between
  the reads can mix commits.
- `composeBranchFacts` renders a `**Facts**` section capped by
  `AUTO_FACTS_CHARS` (6,000, split across mounts) with per-list caps in
  `limits.ts`. A read slower than `AUTO_FACTS_FETCH_MS` (30 s) is cut and
  marked, and a late answer is dropped.
- An unknown mount id refuses `mount_missing`; `facts` on any role but a scout is
  `spec_invalid`.
- The ids live in `request_json.facts`, so a retry reads the facts again. They
  are the state at that moment, never a live view. The scout argv does not
  change.
