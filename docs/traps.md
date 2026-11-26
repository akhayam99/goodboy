# Traps

> **Read this when** something in the code or the toolchain looks like a bug
> and you are about to fix it. **Not for** how a system is meant to work
> (`docs/architecture.md`) or the conventions a change must follow
> (`CONVENTIONS.md`).

Comments are forbidden in the whole repo, so code that looks wrong but is right on purpose cannot explain itself where it sits. These pages hold those explanations. Every trap has been "fixed" at least once and had to be put back.

Before you change something that looks wrong:

1. Find its area in the map below and open the trap.
2. Keep the rule and the test the trap names. If your change makes the trap false, delete it in the same commit.
3. A new trap goes on the page of its area, under its own `###` heading, with one line here.

## Pages

| Page                               | Open it when you change                                         |
| ---------------------------------- | --------------------------------------------------------------- |
| [rust.md](traps/rust.md)           | a Rust command, the phone bridge, credentials, the window close |
| [providers.md](traps/providers.md) | how a provider CLI is spawned, signed in, read or stopped       |
| [git.md](traps/git.md)             | branch reads, commit counts, pushes, rebases, stashes           |
| [review.md](traps/review.md)       | pull requests per mount, hosts, review sources, CI fixes        |
| [resolve.md](traps/resolve.md)     | resolve threads, note fixes, the resolver lane, accepts         |
| [auto.md](traps/auto.md)           | the Auto runtime, its gate, admission, money and publishes      |
| [store.md](traps/store.md)         | selectors, sends, attention counts, the session overview        |
| [folders.md](traps/folders.md)     | plain-folder sessions, saved versions, attachments              |
| [launch.md](traps/launch.md)       | launch reads, the first paint, lazy drawers                     |
| [ui.md](traps/ui.md)               | drawers, the dock, keys and mouse, timelines, Markdown          |
| [scroll.md](traps/scroll.md)       | long scrollers, the chat scroll pin, the text reveal            |
| [browser.md](traps/browser.md)     | browser tabs, capabilities, profiles, injected scripts          |
| [toolchain.md](traps/toolchain.md) | hooks, test runs, CI, the build                                 |
| [database.md](traps/database.md)   | migrations, table rebuilds, the SQL authorizer, Impact          |

## Rust commands and the phone bridge

- [Bridge socket opcodes](traps/rust.md#the-bridge-socket-wire)
- [Noise XK handshake order](traps/rust.md#the-noise-xk-handshake-order)
- [Goodboy must be open](traps/rust.md#goodboy-must-be-open)
- [Pairing identity is owner-only](traps/rust.md#the-pairing-identity-is-owner-only)
- [Credentials resolve in three tiers](traps/rust.md#credentials-resolve-in-three-tiers)
- [A deleted workflow stays on its session](traps/rust.md#a-deleted-workflow-stays-on-its-session)
- [A shared file is replaced, never rewritten](traps/rust.md#a-shared-file-is-replaced-never-rewritten)
- [Rust returns a kind, never a sentence](traps/rust.md#rust-returns-a-kind-and-its-numbers-never-a-sentence)
- [A window close goes through one guard](traps/rust.md#a-window-close-goes-through-one-guard-with-a-rust-fallback)

## Provider CLIs and processes

- [Copilot gets no classic token](traps/providers.md#copilot-gets-no-classic-token)
- [A spawned Claude never thinks it is nested](traps/providers.md#a-spawned-claude-never-thinks-it-is-nested)
- [stderr drains on its own thread](traps/providers.md#a-turn-drains-stderr-on-its-own-thread)
- [The query socket has its own folder](traps/providers.md#the-query-socket-sits-in-its-own-folder)
- [Codex needs the worktree's own git folder](traps/providers.md#codex-needs-the-own-git-folder-of-a-linked-worktree-not-only-the-common-one)
- [Read-only Cursor takes trust, never force](traps/providers.md#a-read-only-cursor-run-takes-the-trust-flag-never-the-force-flag)
- [Claude allow rules name paths](traps/providers.md#a-claude-allow-rule-names-a-path-never-a-variable)
- [Sign-in CLIs speak through exit codes](traps/providers.md#the-sign-in-clis-speak-through-their-exit-code)
- [An unknown subcommand can become a prompt](traps/providers.md#a-cli-may-read-an-unknown-subcommand-as-a-prompt)
- [Auth checks stay off the main IPC thread](traps/providers.md#auth-checks-run-off-the-main-ipc-thread)
- [A lifecycle exit ships the truth](traps/providers.md#a-lifecycle-exit-ships-the-truth)
- [Context bar reads the last assistant message](traps/providers.md#the-context-bar-reads-the-last-assistant-message)
- [Partial output can write a text twice](traps/providers.md#partial-output-writes-a-text-twice-if-the-whole-line-is-not-dropped)
- [The reap walks the tree](traps/providers.md#the-reap-walks-the-tree-not-only-the-group)
- [macOS hides Apple binaries' tags](traps/providers.md#macos-hides-the-tag-of-apple-signed-binaries)
- [A pid is checked before every signal](traps/providers.md#a-pid-is-checked-again-before-every-signal)
- [The reap waits with WNOWAIT first](traps/providers.md#the-reap-waits-with-wnowait-first)
- [A quiet side job is not stuck](traps/providers.md#a-quiet-side-job-is-not-stuck)
- [The reap stops agent daemons too](traps/providers.md#the-reap-stops-an-agents-daemons-too)

## Git reads, pushes and branches

- [Git error text is read in English](traps/git.md#git-error-text-is-read-in-english)
- [The ignore probe is a path inside the folder](traps/git.md#the-ignore-probe-is-a-path-inside-the-folder)
- [A landed branch reads as clean](traps/git.md#a-landed-branch-reads-as-clean)
- [A push count never reads upstream](traps/git.md#a-push-count-never-reads-upstream)
- [A commit list and its count share one base](traps/git.md#a-commit-list-and-its-count-share-one-base)
- [The background repo check never prunes](traps/git.md#the-background-repo-check-never-prunes)
- [Empty repo has no origin HEAD](traps/git.md#an-empty-repository-has-no-originhead-after-its-first-push)
- [New branches are cut from origin](traps/git.md#a-new-branch-is-cut-from-originbase)
- [There is one push verb](traps/git.md#there-is-one-push-verb)
- [Sync and retry never rewrites history](traps/git.md#sync-and-retry-never-starts-the-history-rewriter)
- [Stopped rebase verbs come from one factory](traps/git.md#stopped-rebase-verbs-come-from-one-factory)
- [A rebase stop never leaves a rebase in the worktree](traps/git.md#a-rebase-stop-never-leaves-the-worktree-mid-rebase)
- [Rebase all has one per-branch source](traps/git.md#rebase-all-has-one-source-for-per-branch-state)
- [Uncommitted work never moves with clean or stash](traps/git.md#uncommitted-work-never-moves-with-git-clean-or-git-stash)
- [An install never goes through a link](traps/git.md#an-install-never-goes-through-a-link)
- [A push fix outlives its card](traps/git.md#a-push-fix-outlives-its-card)

### History stashes are shared across worktrees

`refs/stash` lives in the repository's common directory, so history applies and drops only its own stash by exact SHA and never pops. The guard refs, the journal and crash recovery are in [git.md](traps/git.md#history-stashes-are-shared-across-worktrees).

## Pull requests, hosts and CI fixes

- [A pull request is written through its port](traps/review.md#a-pull-request-is-written-through-its-port)
- [sessionGithub is not the shown branch](traps/review.md#sessiongithub-is-the-write-destination-not-the-shown-branch)
- [pullRequestViews is keyed by mount](traps/review.md#pullrequestviews-is-keyed-by-session-and-mount)
- [The Branch page resolves one mount](traps/review.md#the-branch-page-resolves-one-shown-mount)
- [Review comments come from a review source](traps/review.md#review-comments-come-from-a-review-source)
- [No Bitbucket issues](traps/review.md#goodboy-shows-no-bitbucket-issues)
- [RemoteHostKind has no Bitbucket](traps/review.md#remotehostkind-has-no-bitbucket-member)
- [Never read repo state from a transcript](traps/review.md#never-derive-repository-state-from-an-agents-transcript)
- [A CI fix chain survives the push's new run](traps/review.md#a-ci-fix-chain-survives-the-new-run-a-push-starts)
- [CI fix roles have their own kind](traps/review.md#the-ci-fix-roles-have-their-own-kind)

## Resolve queue and fixes

- [resolve_threads is the only verdict history](traps/resolve.md#resolve_threads-is-the-only-verdict-history)
- [The publication row is the publish lock](traps/resolve.md#an-active-publication-row-is-the-publish-lock)
- [Undo of an approval picks its verb](traps/resolve.md#undo-of-an-approval-picks-its-verb)
- [A resolver can exit while its turn settles](traps/resolve.md#a-resolver-can-exit-while-its-turn-still-settles)
- [A failed publication strands the approval](traps/resolve.md#a-failed-publication-strands-the-approval)
- [Every exit from a push preview cancels it](traps/resolve.md#every-way-out-of-a-push-preview-cancels-it)
- [A note fix starts on the owner's working tree](traps/resolve.md#a-note-fix-starts-on-the-owners-working-tree)
- [Notes take one fix at a time](traps/resolve.md#notes-take-one-fix-at-a-time)
- [A landing on the owner's tree is journaled](traps/resolve.md#a-landing-on-the-owners-tree-is-journaled)
- [A tree write overwrites ignored files](traps/resolve.md#a-tree-write-overwrites-an-ignored-file)
- [Shared worktree fast forwards use move_branch](traps/resolve.md#a-fast-forward-in-the-shared-worktree-goes-through-move_branch)
- [A batch resolver never writes the real branch](traps/resolve.md#a-batch-resolver-never-writes-the-real-branch)
- [One lane per worktree](traps/resolve.md#one-lane-per-worktree-one-agent-at-a-time)
- [Each fix is built on the one before](traps/resolve.md#each-fix-is-built-on-the-one-before)
- [A broken chain link is rebuilt](traps/resolve.md#a-broken-link-in-the-chain-is-rebuilt)
- [A failed rebuild never relaunches alone](traps/resolve.md#a-failed-rebuild-never-relaunches-on-its-own)
- [A source sync hands the lane its comments](traps/resolve.md#a-source-sync-hands-the-lane-its-own-comments)
- [An accept fast-forwards through the chain](traps/resolve.md#an-accept-fast-forwards-through-the-chain)
- [Hints when a fix starts](traps/resolve.md#hints-when-a-fix-starts)

## Auto

- [Auto gate and screens](traps/auto.md#auto-gate-and-screens)
- [The registry reads the gate, not context](traps/auto.md#the-registry-reads-the-gate-not-react-context)
- [Auto's glyph and color](traps/auto.md#autos-glyph-and-color-are-its-own)
- [Delegation cards are placed by time](traps/auto.md#delegation-cards-are-placed-by-time)
- [Auto chat scenes set lastViewedAt](traps/auto.md#an-auto-chat-scene-sets-lastviewedat)
- [An agent page composer takes its own id](traps/auto.md#an-agent-pages-composer-takes-its-own-agent-id)
- [A prompt line never says possible is impossible](traps/auto.md#a-prompt-line-never-calls-a-possible-action-impossible)
- [Approval goes through effectiveApproval](traps/auto.md#approval-is-read-through-effectiveapproval)
- [A plan approval tells Auto once](traps/auto.md#the-approval-of-a-plan-tells-auto-once)
- [The approval turn names the plan](traps/auto.md#the-approval-turn-names-the-plan)
- [Only a plan waits on approval](traps/auto.md#only-a-plan-waits-on-approval)
- [Admission is written twice](traps/auto.md#the-admission-rule-is-written-twice-on-purpose)
- [The resume is admitted twice](traps/auto.md#the-resume-is-admitted-twice-too)
- [First attempt reservations by owner id](traps/auto.md#the-first-attempts-reservation-is-found-by-owner-id)
- [No dollar ceiling per child](traps/auto.md#no-dollar-ceiling-per-child)
- [No count or clock stops a tree](traps/auto.md#no-count-or-clock-stops-a-tree)
- [Four running children is a start rule](traps/auto.md#four-running-children-is-a-start-rule)
- [Auto money is REAL dollars](traps/auto.md#auto-money-is-real-dollars)
- [Messages to Auto go through the door](traps/auto.md#a-message-to-an-auto-agent-goes-through-the-door)
- [An operator message to a child is a continue](traps/auto.md#an-operator-message-to-a-child-is-a-continue)
- [A child is found by its delegation row](traps/auto.md#a-child-is-found-by-its-delegation-row)
- [An adopted source stays ordinary](traps/auto.md#an-adopted-source-stays-an-ordinary-agent)
- [Auto standing comes from the stored delegation](traps/auto.md#a-turns-auto-standing-is-read-from-the-stored-delegation)
- [A child that fails to start says why](traps/auto.md#an-auto-child-that-fails-to-start-says-why)
- [Publishing bridge acts are Access::Publish](traps/auto.md#a-publishing-bridge-act-is-declared-accesspublish)
- [The online sha is recorded at launch](traps/auto.md#the-online-branch-sha-is-recorded-at-launch-only)
- [Changed files compare trees](traps/auto.md#a-writers-changed-files-compare-trees)
- [Green needs a clean, unmoved tree](traps/auto.md#a-check-verdict-is-green-only-on-a-clean-unmoved-tree)
- [A new result field joins the signature](traps/auto.md#a-card-that-reads-a-new-result-field-adds-it-to-the-signature)
- [A publish is written in two places](traps/auto.md#a-publish-is-written-in-two-places-that-agree)

## Store and session state

- [stageInfoOf reads only its input](traps/store.md#stageinfoof-reads-only-the-state-it-is-given)
- [Not every select helper is a safe selector](traps/store.md#a-store-helper-named-select-is-not-always-a-safe-selector)
- [A plan's run is found by its link](traps/store.md#a-plans-run-is-found-by-its-link)
- [Stored paths are absolute](traps/store.md#stored-paths-are-absolute)
- [The Storage verdict has two owners](traps/store.md#the-storage-verdict-has-two-owners)
- [A tool's health has one author](traps/store.md#a-tools-health-has-one-author)
- [RoutingPicker hands the whole route](traps/store.md#routingpicker-hands-the-whole-route-in-one-call)
- [Not finished is a skip with a summary](traps/store.md#not-finished-is-a-skip-that-carries-a-summary)
- [A fan-out parent joins every ended child](traps/store.md#a-scout-fan-out-parent-joins-every-ended-child)
- [A turn-end read waits for a question or split](traps/store.md#a-turn-end-read-waits-for-a-question-or-a-split)
- [A send writes its row before it delivers](traps/store.md#a-send-writes-its-row-before-it-delivers)
- [Banner clicks reach every window](traps/store.md#banner-clicks-reach-every-window-and-the-badge-has-one-writer)
- [Two attention counts per workspace](traps/store.md#two-counts-for-one-workspace-and-the-rust-count-is-a-subset)
- [Hand-maintained lists the compiler does not check](traps/store.md#hand-maintained-lists-the-compiler-does-not-check)
- [The auto role stays out of visible lists](traps/store.md#the-auto-role-stays-out-of-every-list-a-person-sees)
- [Auto writer roles are written three times](traps/store.md#the-auto-writer-roles-are-written-three-times)

### Session overview cards

The overview is one set of cards with one reader per fact, and it must open fast on a large session. Its traps are in [store.md](traps/store.md#session-overview-cards):

- [There is one overview](traps/store.md#there-is-one-overview)
- [buildTimelineStream is a folder](traps/store.md#buildtimelinestream-is-a-folder-of-pieces)
- [A large session must open fast](traps/store.md#a-large-session-must-open-fast)
- [Three shared pieces keep their defaults](traps/store.md#three-shared-pieces-keep-their-old-defaults)
- [batchId is whitelisted](traps/store.md#batchid-is-whitelisted)
- [The branch story has one reader](traps/store.md#the-branch-story-has-one-reader)
- [A null check is not "not needed"](traps/store.md#a-null-check-is-not-not-needed)
- [useBranchDetails keys on ids](traps/store.md#usebranchdetails-keys-on-ids-not-the-mount-entry)
- [A row title is one sentence](traps/store.md#a-row-title-is-one-sentence)
- [Board row counts come from the rows drawn](traps/store.md#board-row-counts-come-from-the-rows-drawn)

## Plain folders, session files and attachments

- [A session marker has two shapes](traps/folders.md#a-plain-folder-session-marker-has-two-shapes)
- [A session marker is never missing](traps/folders.md#a-session-marker-is-never-missing)
- [Only its own session removes a folder](traps/folders.md#a-session-folder-is-removed-only-by-its-own-session)
- [Before copies keep their old place](traps/folders.md#the-before-copies-keep-their-old-place)
- [Folder history is not where agents write](traps/folders.md#history-of-a-folder-is-not-where-an-agent-may-write)
- [Materialize needs the saved copy](traps/folders.md#the-materialize-bridge-needs-the-folders-saved-copy)
- [Unlinking waits for the open turn](traps/folders.md#unlinking-a-folder-waits-for-its-open-turn)
- [Attachments are checked twice](traps/folders.md#attachments-are-checked-twice)
- [A dropped file is read through its handle](traps/folders.md#a-dropped-file-is-read-through-its-handle)
- [Attachments never need a worktree](traps/folders.md#attachments-never-need-a-worktree)

## Launch and loading

- [Three frames paint the same chrome](traps/launch.md#three-frames-paint-the-same-chrome)
- [The setup wizard decides once per window](traps/launch.md#the-setup-wizard-decides-once-per-window)
- [The launch reads once](traps/launch.md#the-launch-reads-once-and-hands-the-answers-down)
- [No query before this build's migrations](traps/launch.md#no-query-runs-before-the-migrations-of-this-build)
- [A board fact read late moves cards](traps/launch.md#a-board-fact-read-after-the-first-paint-moves-cards)
- [Unopened sessions hold light agent rows](traps/launch.md#a-session-you-did-not-open-holds-light-agent-rows)
- [Some drawers load on first open](traps/launch.md#some-drawers-load-on-first-open)

## Window, drawers and rendering

- [navigate closes a foreign drawer](traps/ui.md#navigate-closes-the-drawer-unless-it-is-a-tool-of-the-same-session)
- [A parked drawer is still mounted](traps/ui.md#a-parked-drawer-is-still-mounted)
- [New drawer actions host](traps/ui.md#new-drawer-actions-host)
- [A fold is a view, never a write](traps/ui.md#a-fold-is-a-view-never-a-write)
- [Ask and Scripts are grid cells](traps/ui.md#ask-and-scripts-are-cells-of-the-grid)
- [Menu bar and web view share Command keys](traps/ui.md#the-menu-bar-and-the-web-view-share-every-command-key)
- [A right click reads the earlier selection](traps/ui.md#a-right-click-reads-the-selection-held-before-the-press)
- [The session rail has one current branch](traps/ui.md#the-session-rail-has-one-current-branch)
- [Drags use pointer events](traps/ui.md#drags-use-pointer-events-never-html5-drag-and-drop)
- [Hover card triggers](traps/ui.md#hover-card-triggers)
- [A terminal view subscribes before its snapshot](traps/ui.md#a-terminal-view-subscribes-before-it-reads-the-snapshot)
- [Recipes read down, runs read up](traps/ui.md#a-recipe-reads-top-down-a-run-reads-bottom-up)
- [Timeline rows share one pixel grid](traps/ui.md#timeline-rows-share-one-pixel-grid)
- [Markdown reuses unchanged blocks](traps/ui.md#markdown-reuses-the-element-of-an-unchanged-block)
- [A kit block closer can carry an extra bracket](traps/ui.md#a-kit-block-closer-can-arrive-with-one-bracket-too-many)
- [Explore decides text from content](traps/ui.md#explore-decides-text-from-content-not-the-extension)
- [The PDF preview is blank in a release build](traps/ui.md#the-pdf-preview-is-blank-in-a-release-build)
- [Links open on http and https only](traps/ui.md#links-open-on-http-and-https-only)
- [Theme switch is an instant swap](traps/ui.md#theme-switch-is-an-instant-swap)

## Scrolling and the text reveal

- [Scroll anchoring in the webview](traps/scroll.md#scroll-anchoring-in-the-webview)
- [Diff file body height](traps/scroll.md#diff-file-body-height)
- [The reveal hold in the chat scroll](traps/scroll.md#the-reveal-hold-in-the-chat-scroll)
- [An upward move unpins at once](traps/scroll.md#a-readers-upward-move-unpins-at-once)
- [Live mark for the text reveal](traps/scroll.md#live-mark-for-the-text-reveal)
- [Fresh spans clone with children spread](traps/scroll.md#a-fresh-span-is-cloned-with-its-children-spread)
- [A fading row outlives its delay](traps/scroll.md#a-fading-rows-piece-outlives-its-delay)

## Browser tabs

- [An overlay over a tab is drawn under it](traps/browser.md#an-overlay-over-a-tab-is-drawn-under-it)
- [The command wall is the guard](traps/browser.md#the-command-wall-is-the-guard-not-the-label)
- [The navigation rule is the first wall](traps/browser.md#the-navigation-rule-is-the-first-wall)
- [The placement loop writes nothing when steady](traps/browser.md#the-placement-loop-writes-nothing-on-a-steady-frame)
- [Profiles differ per platform](traps/browser.md#a-browser-profile-is-not-the-same-thing-on-every-platform)
- [A tab hides its window from webview_windows](traps/browser.md#a-window-that-holds-a-tab-is-invisible-to-webview_windows)
- [Tabs get the app's initialization scripts](traps/browser.md#every-tab-gets-the-apps-initialization-scripts)
- [Plugin scripts reach every tab](traps/browser.md#plugin-scripts-reach-every-tab-too)
- [Webview url() panics on a new tab](traps/browser.md#webviewurl-panics-on-a-tab-with-no-url-yet)
- [The passkey watch never breaks the call](traps/browser.md#the-passkey-watch-never-breaks-the-pages-call)
- [Every local page shares one origin](traps/browser.md#every-local-page-shares-one-origin)

## Traps in the toolchain

Hooks, test runs, CI and the build are in [toolchain.md](traps/toolchain.md). The SQLite traps of views and search triggers moved to [database.md](traps/database.md#drop-table-keeps-the-views-that-read-the-table).

- [A new worktree's install exits 1](traps/toolchain.md#a-new-worktrees-pnpm-install-exits-1)
- [The pre-commit hook borrows main's tools](traps/toolchain.md#the-pre-commit-hook-borrows-the-main-checkouts-tools)
- [commitlint wants a lower-case subject](traps/toolchain.md#commitlint-wants-a-lower-case-subject)
- [A scriptless install fails two suites](traps/toolchain.md#a-worktree-installed-without-scripts-fails-two-suites-quietly)
- [FULL TURBO can be a replay](traps/toolchain.md#a-full-turbo-green-can-be-a-replay)
- [Arguments after pnpm test never reach turbo](traps/toolchain.md#arguments-after-pnpm-test-never-reach-turbo)
- [Text file busy in Rust tests](traps/toolchain.md#a-rust-test-that-runs-a-script-it-wrote-can-hit-text-file-busy)
- [lsof exits 1 on nothing](traps/toolchain.md#lsof-exits-1-when-it-finds-nothing)
- [cargo fmt formats the whole crate](traps/toolchain.md#cargo-fmt-formats-the-whole-crate)
- [CI has no run workflow button](traps/toolchain.md#ci-has-no-run-workflow-button)
- [The CSP admits no remote image](traps/toolchain.md#the-webview-csp-admits-no-remote-image)
- [No bundled assignment to a prototype name](traps/toolchain.md#a-bundled-dependency-must-not-assign-to-an-objectprototype-name)

## SQLite, migrations and Impact reads

- [Migration versions are contiguous](traps/database.md#migration-versions-form-one-contiguous-range)
- [Shipped SQL is pinned by hash](traps/database.md#a-shipped-migrations-sql-is-pinned-by-hash)
- [DROP TABLE keeps its views](traps/database.md#drop-table-keeps-the-views-that-read-the-table)
- [A rebuild drops its search triggers](traps/database.md#a-table-rebuild-drops-its-search-triggers)
- [auto rebuilds turn foreign keys off](traps/database.md#an-auto_-rebuild-turns-foreign-keys-off)
- [The SQL authorizer sees inner statements](traps/database.md#the-webview-sql-authorizer-sees-what-sqlite-runs-inside-a-statement)
- [Impact counts deleted sessions](traps/database.md#impact-counts-deleted-sessions-on-purpose)
- [Impact never reads github_pr_cache](traps/database.md#impact-never-reads-github_pr_cache)
- [Impact settles live mounts by sweep](traps/database.md#impact-settles-a-live-mount-only-through-the-sweep)
