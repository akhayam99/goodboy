# Goodboy features

The full feature guide, in the same order as [goodboy-ai.dev](https://goodboy-ai.dev): set up, start a task, move between tasks, ship the code, then keep an eye on cost and disk. Each entry says what the feature does for you and how you use it.

Most pictures follow one team and one task. Harborline keeps three repos, payments-api, ledger-core and notify-relay, and issue HBL-412 says retried webhooks post a second credit. The pictures show that fix from the first brief to pull request #318.

<a id="welcome-to-goodboy"></a><a id="provider-connection"></a><a id="one-page-per-provider"></a><a id="update-the-provider-cli"></a><a id="permissions-for-each-provider"></a><a id="integrations"></a><a id="about-you"></a>

## Set up

Get from install to a first agent: connect a provider, check what it can do, link your tools and tell agents who you are.

- Welcome to Goodboy
- Provider connection
- Integrations

[More on set up](docs/features/setup.md)

<a id="how-do-you-want-to-start"></a><a id="pick-up-a-task-with-a-drafted-brief"></a><a id="run-a-workflow"></a><a id="ask-an-agent"></a><a id="start-blank"></a><a id="named-by-goodboy"></a>

## Start a task

Begin from an issue, a workflow or a question, in one draft that turns into a session when you press Start.

- Pick up a task, with a drafted brief
- Run a workflow
- Ask an agent

[More on starting a task](docs/features/start.md)

<a id="session-overview"></a><a id="refresh-a-session"></a><a id="activity"></a><a id="next"></a><a id="time-left"></a><a id="file-versions"></a>

## Overview and activity

Open a session and read everything about the task in one place: its goal, its projects, and the timeline of what happened.

- Session overview
- Activity
- Next

[More on overview and activity](docs/features/overview.md)

<a id="activity-bar"></a><a id="now-chip"></a><a id="notifications"></a><a id="open-in-new-window"></a>

## Switch between tasks

Move between the tasks of a workspace, and see from any screen which one needs you.

- Activity bar
- Now chip
- Notifications

[More on switching between tasks](docs/features/switching.md)

<a id="go-anywhere"></a><a id="command-palette"></a><a id="search"></a><a id="right-click-menus"></a>

## Search and navigation

Find any session, message, plan or action, and reach it from the keyboard.

- Go anywhere
- Command palette
- Search

[More on search and navigation](docs/features/search.md)

<a id="start-a-project-from-nothing"></a><a id="workspace-with-several-projects"></a><a id="starred-projects-descriptions-and-base-branch"></a><a id="worktrees"></a><a id="several-branches-per-project"></a><a id="workspace-switcher-and-reconnect"></a><a id="repo-status-across-projects"></a><a id="locate-moved-projects"></a><a id="keep-goodboy-out-of-git"></a>

## Workspace and projects

Keep your repos together, and let sessions work across them.

- Workspace with several projects
- Worktrees
- Repo status across projects

[More on workspace and projects](docs/features/workspace.md)

<a id="rewrite-history"></a><a id="safe-apply"></a><a id="conflict-prediction"></a><a id="conflicts-merged-in-a-copy"></a><a id="push-with-lease-and-restore"></a><a id="backups"></a><a id="suggest-a-message"></a><a id="bring-them-into-the-plan"></a><a id="rebase-on-main"></a><a id="after-a-pull-request-merges"></a>

## Branch history

Reshape a branch before it goes to review: fold, move, rename and remove commits, see what would conflict, and apply with a backup one click away.

- Rewrite history
- Safe apply
- Conflict prediction

[More on branch history](docs/features/branch-history.md)

<a id="resolve"></a><a id="review-sources"></a><a id="comment-states"></a><a id="failed-drafts"></a><a id="manage-a-resolve-from-its-brief"></a><a id="fixes-already-on-the-branch"></a><a id="a-fix-that-went-missing"></a><a id="close-on-github"></a><a id="review-replies-in-your-voice"></a><a id="fixes-on-a-branch-that-moved"></a><a id="squash-and-fold-the-resolve-commits"></a><a id="notes-before-a-pull-request"></a><a id="github-pull-request-page"></a><a id="pull-request-diff-and-review-as-layers"></a><a id="write-it-for-me"></a><a id="pr-description-follows-the-push"></a><a id="diff"></a><a id="write-review"></a>

## Review, resolve and pull requests

Turn review comments into commits, push them back to GitHub, and read your own pull requests and diffs before anyone else does.

- Resolve
- Review sources
- Close on GitHub
- Diff

[More on review, resolve and pull requests](docs/features/review.md)

<a id="stage-board"></a><a id="session-card"></a><a id="done-and-archived-dock"></a><a id="bulk-select"></a>

## The board

The board shows every session of a workspace by stage. Workflows chain agents into one run you can steer.

- Stage board
- Session card

[More on the board](docs/features/board.md)

<a id="workflow-builder"></a><a id="orchestrated"></a><a id="preset-and-custom"></a><a id="built-in-workflows"></a><a id="saved-steps"></a><a id="model-per-step"></a><a id="autorun"></a><a id="spend-limit"></a><a id="chained-starts"></a><a id="workflow-run"></a><a id="hints-to-the-orchestrator"></a><a id="why-each-step-and-the-run-recap"></a><a id="step-handoff-summary"></a><a id="open-questions"></a><a id="let-an-agent-decide"></a><a id="import-workflows"></a>

## Workflows

A workflow runs several agents in one session, each step with its own role, model and effort.

- Workflow builder
- Orchestrated
- Workflow run
- Spend limit

[More on workflows](docs/features/workflows.md)

<a id="supported-tools"></a><a id="agents-use-your-tools"></a><a id="inbox"></a><a id="find-any-issue-by-code-or-link"></a><a id="starred-issues"></a><a id="launch-a-session-from-any-item"></a><a id="link-an-item-to-a-session"></a><a id="trackers"></a><a id="code-hosts"></a><a id="slack-what-agents-can-do"></a><a id="reply-ready-for-channel"></a><a id="slack-signature"></a><a id="images-from-your-tools"></a><a id="records-read-the-same-way"></a><a id="comment-threads"></a>

## Inbox and your tools

Connect your trackers, code hosts and Slack once. Their work lands in one Inbox, and agents can read and act on it.

- Inbox
- Trackers
- Code hosts
- Launch a session from any item

[More on inbox and your tools](docs/features/inbox.md)

<a id="artifacts"></a><a id="plan-parts-and-run-plan"></a><a id="report-as-a-document"></a><a id="files-on-disk"></a><a id="create-a-wireframe"></a><a id="wireframes-scouted-first"></a><a id="wireframe-versions"></a><a id="compare"></a><a id="ask-for-a-change"></a><a id="import-wireframe-json"></a><a id="revisions-and-restore"></a><a id="save-a-copy-and-new-variant"></a>

## Plans, reports and wireframes

Plans, reports and wireframes live next to the task, not inside a chat.

- Artifacts
- Create a wireframe
- Compare

[More on plans, reports and wireframes](docs/features/artifacts.md)

<a id="decisions"></a><a id="see-why-each-decision-was-made"></a><a id="running-summary"></a><a id="context-drawer"></a><a id="context-budgets"></a><a id="plans-handed-to-the-next-agent"></a>

## Shared context

What one agent learns, the next one reads. The goal, decisions and a running summary travel with the session.

- Decisions
- Running summary
- Context drawer

[More on shared context](docs/features/context.md)

<a id="usage-limits-chip"></a><a id="use-reset"></a><a id="fallback-when-a-limit-is-hit"></a><a id="fallback-order-and-auto"></a><a id="model-picker"></a><a id="impact"></a><a id="monthly-cap-and-budget-alert"></a>

## Providers, limits and cost

Watch how much of each plan is left, keep work moving when a provider runs out, and see what it all costs.

- Usage limits chip
- Fallback when a limit is hit
- Model picker
- Impact
- Monthly cap and budget alert

[More on providers, limits and cost](docs/features/providers.md)

<a id="worktree-folders"></a><a id="branches"></a><a id="storage-scope"></a><a id="free-space-chip"></a><a id="artifacts-from-deleted-sessions"></a><a id="goodboy-can-free-n-gb"></a>

## Storage

Free disk space and clean up branches, with what is safe to remove spelled out.

- Worktree folders
- Branches
- Goodboy can free N GB

[More on storage](docs/features/storage.md)

<a id="security-findings"></a><a id="findings-kept-out-of-the-export"></a><a id="export-and-import-your-setup"></a><a id="backup-before-a-data-update"></a><a id="newer-data-guard"></a><a id="updates"></a><a id="changelog-in-the-app"></a><a id="before-and-after-pictures"></a><a id="guide"></a>

## Security, backup and updates

Keep tokens out of what you save, move your setup between machines, and update without losing data.

- Security findings
- Export and import your setup
- Updates

[More on security, backup and updates](docs/features/security.md)

<a id="workspace-chat"></a><a id="roles"></a><a id="agent-header"></a><a id="what-the-agent-received"></a><a id="agent-transcript"></a><a id="agent-suggests"></a><a id="queue-or-send-now"></a><a id="stop-and-continue"></a><a id="turn-footer"></a><a id="tool-call-states"></a><a id="composer-plus-menu"></a><a id="attach-files"></a><a id="drift-warning"></a><a id="subagents-from-plan-parts"></a><a id="history-rewriter-and-scribe"></a><a id="one-language-per-session"></a>

## Agents

Talk to agents, watch what they do and steer them while they work.

- Workspace chat
- Roles
- Agent transcript

[More on agents](docs/features/agents.md)

<a id="report-a-bug"></a>

## Support Goodboy

The best support is running Goodboy on the work you already have. When something feels off, or you have an idea, report it from inside the app in one line.

- Report a bug

[More on supporting Goodboy](docs/features/support.md)

<a id="terminal"></a><a id="keyboard-shortcuts-back-and-forward"></a><a id="script-drawer"></a><a id="open-in-editor"></a><a id="explore"></a>

## Keyboard and terminal

Open a real login shell in the session's worktree. **⌘⌥T** opens the Terminal view, **⌘T** adds a tab, and the shell is still there after a reload. **⌘F** finds in its scrollback.

- Terminal
- Keyboard shortcuts, back and forward
- Explore

[More on keyboard and terminal](docs/features/keyboard.md)

<a id="also-there"></a>
