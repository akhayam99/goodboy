# Traps in pull requests, hosts and CI fixes

> **Read this when** you change how Goodboy reads or writes a pull request,
> picks a host, reads review comments or follows a CI fix. **Not for** the
> resolve queue and its fixes ([resolve.md](resolve.md)) or host adapters
> ([../hosts.md](../hosts.md)).

## One mount, one request

A session can hold several mounts, and a PR number is not an identity: `ledger-core` and `payments-api` can both have a 12. A read or write that does not name its mount lands on the active one, where another request may share the number.

### A pull request is written through its port

Writes go through `PullRequestPort` (`ReviewSource.pullRequest`, built per host by `pullRequestPortFor`); the github slice verbs, `usePullRequestView` and the Branch page never build `gh` arguments. A control reads `REVIEW_SOURCE_CAPABILITIES`, never the host name, and a flag is `true` only with its port method and test (`reviewSourceContract.test.ts`, `pullRequestPortContract.test.ts`). Merge readiness is one function, `evaluatePrMergeReadiness`, for the Branch header and the companion.

### `sessionGithub` is the write destination, not the shown branch

`sessionGithub` projects the write destination (`sessionActiveMount`) and is re-derived only when a GitHub write lands. A page about a branch reads `sessionPullRequestOf({ mountId })` or `branchGithubOf({ mountId })` for the shown mount. These all take that `mountId`:

- the Pull request page and the Checks tab (`BranchChecks`); for GitLab or Bitbucket it picks its entry with `selectedReviewEntryOf({ mountId })` (no fallback to another mount) and reads `usePullRequestView({ mountId })`;
- the branch tabs (`branchScopeOf({ mountId })`, counting that branch's notes and threads only) and the `pullRequest` action target;
- the lifecycle writes (`markPrReady`, `mergePr`, `reopenPr`, `convertPrToDraft`, `closePr`) and their refresh, through `PrWriteOptions`;
- `requestReview`, `editPr`, the reviewer search (`usePullRequestPort({ mountId })`), the create form's reviewer step and the Scribe settle (`work.mountId`).

`refreshMountPr` keeps the known request when a poll of the same branch and repository answers empty.

### `pullRequestViews` is keyed by session and mount

`pullRequestViews[sessionId][mountId]` (key `none` without a mount) holds one view with its own `edits`. Read it only through `pullRequestViewOf({ state, sessionId, mountId, prNumber })` or `pullRequestViewAt`, so readiness, the merge word and reviewers never come from another repository.

### The Branch page resolves one shown mount

`useBranchIdentity` resolves it and the page passes its `mountId` to `useBitbucketRemote` (new-request link and noun), `useActiveReviewSource`, `useReviewEntries`, `useReviewPush`, `ReviewFlow` and `PushBanner`. The host word is the shown request's host (`identity.host`), else the shown repository's remote, never the write destination's.

A push of review fixes names its mount all the way: `preparePublication` and `retryPublication` take `mountId`, `publishConversations` reads the frozen `mountTarget`, and the confirm names the repository when there are several. Back and a reload never move the write destination.

### Review comments come from a review source

Comments come from a `ReviewSource` (`packages/core/src/review-source/`), never `sessionGithub` alone. `activeReviewSourceOf` picks the source of the named mount (the active one when none): comments, PR or MR number, url, head branch, capabilities. Replies and resolves go through `reviewSourceFor`, keyed by `resolve_threads.source_kind` and `provider_thread_id`:

- GitLab: `gitlab:<discussionId>`, and `pr_number` is the MR iid;
- Bitbucket: `bitbucket:<rootCommentId>`, one thread per inline root comment, replies under the root.

`approvedPublicationScope({ include })` scopes a publication to the picked source, so pushing GitLab never posts GitHub rows. `resolveStepPlan` leaves a thread open where the source cannot resolve (Bitbucket replies only), and where `canResolve` is false the comment has no "Resolve" and the confirm says it stays open. Read `sessionRequests` (via `gitlabSessionOf`, `bitbucketSessionOf`) and `reviewSourceThreads` through selectors: picking a source in another project calls `setSessionActiveMount`.

## Hosts

### Goodboy shows no Bitbucket issues

`fetchIssueCandidates` returns `[]` for Bitbucket and `issueSources.ts` has no entry, because Atlassian points issues at Jira. Adding only the entry ships a picker that lists nothing. The mobile companion refuses the provider in `commandExecutor.ts`.

### `RemoteHostKind` has no Bitbucket member

A Bitbucket remote is `'other'`, and `remoteHost.test.ts` checks it. The pull-request screens switch on `PullRequestProvider`, which has `'bitbucket'`, so they need no `RemoteHostKind` member.

## CI fixes

### Never derive repository state from an agent's transcript

A quiet commit (`commit -qam ... && log --oneline -1`) prints no `[branch sha]`, so a regex reads "no commit". `readCheckFixCommit` (`listBranchCommits`: the newest commit after the fix started, and its `pushed` flag) says whether a CI fix committed and pushed. A check chain reads it through `selectCheckChain`, with `commitOf` only when the repository is unreadable. `useCheckFixCommitSync` re-reads when the mount's head or upstream distance changes, or the card stays on "not pushed".

### A CI fix chain survives the new run a push starts

A chain is keyed by the analyzed check URL, and a push starts a run with a new URL. `checkTargetOf` keeps the mount's latest analysis (same URL or check name), so the chain does not fall to `none`, and `checkOutcomeOf` reads the new run by name: the old URL is "running", never "still fails". It ties an analyst to its mount through `selectCheckMount`, which matches the URL against each mount's pull requests and check runs; agents since m233 also store `agents.mount_id`, NULL once the worktree row goes.

A CI fix agent's Activity row finds its mount through `ciFixMountOf`:

1. the stored mount, while attached;
2. `selectCheckMount`;
3. the one attached mount whose `repoSlug` is the job URL's repo;
4. the session's only attached mount;
5. else it opens the chat, as for older agents or two mounts of one repo.

### The CI fix roles have their own kind

They are `ci-debugger` and `ci-fixer`. `ciFixRoleOf` still reads an older `debugger` or `implementer` as a CI role when the agent has a failed-check source. An unknown stored role reads as the generalist and warns once in development, so a downgrade never breaks Activity. The generic "Review the changes" card never fires on a `ci-fixer`: the CI fix card owns that step.
