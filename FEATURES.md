# Goodboy features

The full feature guide, from setup and your tools to starting a task, reviewing and shipping the code, then cost, disk and shortcuts. Each entry gives one sentence on what the feature does for you, and its page says how to use it.

New here? [Your first task](docs/first-session.md) walks from install to a merged pull request, and three [walkthroughs](docs/walkthroughs/fix-a-failing-check.md) follow common paths.

Most pictures follow one team and one task. Harborline keeps three repos, payments-api, ledger-core and notify-relay, and issue HBL-412 says retried webhooks post a second credit. The pictures show that fix from the first brief to pull request #318.

<a id="welcome-to-goodboy"></a><a id="your-agents"></a><a id="provider-connection"></a><a id="your-first-workspace"></a><a id="home"></a><a id="one-page-per-provider"></a><a id="update-the-provider-cli"></a><a id="permissions-for-each-provider"></a><a id="integrations"></a><a id="about-you"></a><a id="settings-home"></a><a id="settings"></a>

## Set up

Get from install to a first agent. Check the agents on this Mac, make a workspace from your folders, link your tools and tell agents who you are.

- **Welcome to Goodboy**: Four short steps take you from install to a first agent reading your code.
- **Your agents**: Goodboy runs the coding agents already on this Mac, and one ready agent is enough.
- **Your first workspace**: A workspace is what you work on: one repository, or a folder that holds several.
- **Home**: A window with no workspace open shows Home, which lists your workspaces with their folder count and where their folders live.
- **Integrations**: Connect GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack from one page, and see the account behind each.

[More on set up](docs/features/setup.md)

<a id="supported-tools"></a><a id="agents-use-your-tools"></a><a id="inbox"></a><a id="tasks"></a><a id="find-any-issue-by-code-or-link"></a><a id="starred-issues"></a><a id="start-from-any-item"></a><a id="link-an-item-to-a-session"></a><a id="trackers"></a><a id="code-hosts"></a><a id="slack-what-agents-can-do"></a><a id="reply-ready-for-channel"></a><a id="slack-signature"></a><a id="images-from-your-tools"></a><a id="records-read-the-same-way"></a><a id="comment-threads"></a>

## Tasks and your tools

Connect your trackers, code hosts and Slack once. Their work lands in one list called Tasks, and agents can read and act on it without leaving Goodboy.

- **Tasks**: Work from one list instead of seven tabs.
- **Trackers**: Read Sentry errors with stack trace, breadcrumbs and tags inside Goodboy, and filter them by project.
- **Code hosts**: Work on GitHub pull requests and issues, GitLab merge requests, and Bitbucket comments, approvals and merges without leaving Goodboy.
- **Start from any item**: Press Start session on an issue or an error, or Start from HBL-412 from the row's menu.

[More on tasks and your tools](docs/features/inbox.md)

<a id="start-a-run"></a><a id="what-auto-chose-and-change"></a><a id="the-kind-chip"></a><a id="the-model-of-a-run"></a><a id="the-new-session-page"></a><a id="start-on-a-task"></a><a id="how-do-you-want-to-start"></a><a id="pick-up-a-task-with-a-drafted-brief"></a><a id="review-a-pull-request"></a><a id="run-a-workflow"></a><a id="ask-an-agent"></a><a id="start-an-agent"></a><a id="start-more-work-in-a-session"></a><a id="start-blank"></a><a id="named-by-goodboy"></a><a id="undo-an-unlink"></a><a id="move-an-issue-between-the-session-and-a-branch"></a><a id="start-one-session-from-several-issues"></a><a id="star-an-issue-from-link-work"></a>

## Start a task

Begin from an issue, a workflow or a question. Everything starts as one draft, and it becomes a session only when you press Start, so empty sessions do not pile up.

- **The New session page**: Start a session from your goal: write it or pick an issue, then choose the kind of run.
- **Start a run**: Write what you want done and press Start.
- **Start on a task**: Start a session from an issue in Tasks, with the issue linked and its goal written in.
- **Review a pull request**: A pull request waiting on you in Tasks shows Review pull request in place of Start.

[More on starting a task](docs/features/start.md)

<a id="session-overview"></a><a id="refresh-a-session"></a><a id="activity"></a><a id="full-log"></a><a id="cards"></a><a id="new-session-overview-experimental"></a><a id="next"></a><a id="time-left"></a><a id="changes"></a><a id="file-versions"></a>

## Overview and activity

Open a session to see what it is for, what needs you and what happened so far.

- **Session overview**: Read a session as one page: the goal, what needs you, what runs and where each branch stands.
- **Cards**: See what needs you, what runs, what is next, where each branch stands and what finished.
- **Full log**: Follow what happened in a session in one list.
- **Next**: Know the moves that unblock the task, such as answering a question, fixing a failing check or opening a pull request.

[More on overview and activity](docs/features/overview.md)

<a id="stage-board"></a><a id="session-card"></a><a id="list-view"></a><a id="done-and-archived-dock"></a><a id="done-and-archived-lanes"></a><a id="bulk-select"></a>

## The board

The board shows every session of a workspace in lanes by stage, so you see where each task stands and which ones need you. Sessions move between lanes by themselves as their work changes.

- **Stage board**: See where each task stands without moving cards around.
- **Session card**: Read a task at a glance: its title on two lines, its project in gray, and one signal at the right.
- **List view**: Scan every session in one table.

[More on the board](docs/features/board.md)

<a id="session-list"></a><a id="pin-a-session-to-keep-it-at-the-top"></a><a id="now-chip"></a><a id="notifications"></a><a id="open-in-new-window"></a>

## Switch between tasks

Move between the tasks of a workspace without losing your place, and see from any screen which one needs you.

- **Session list**: The left column lists the sessions of the workspace, one line each.
- **Pin a session to keep it at the top**: Keep the sessions you return to at the top of the list.
- **Now chip**: Know what runs from any screen.
- **Notifications**: Catch up in one place.

[More on switching between tasks](docs/features/switching.md)

<a id="resolve"></a><a id="hints-when-a-fix-starts"></a><a id="bulk-actions"></a><a id="review-sources"></a><a id="comment-states"></a><a id="failed-drafts"></a><a id="see-what-a-resolve-did"></a><a id="fixes-already-on-the-branch"></a><a id="a-fix-that-went-missing"></a><a id="close-on-github"></a><a id="review-replies-in-your-voice"></a><a id="fixes-on-a-branch-that-moved"></a><a id="squash-and-fold-the-resolve-commits"></a><a id="notes-before-a-pull-request"></a><a id="github-pull-request-page"></a><a id="pull-request-diff-and-review-as-layers"></a><a id="write-it-for-me"></a><a id="write-it"></a><a id="pr-description-follows-the-push"></a><a id="diff"></a><a id="write-review"></a><a id="read-the-code"></a><a id="pull-request-on-the-branch-page"></a><a id="one-trail-to-the-branch-page"></a>

## Review and resolve on the Branch page

The Branch page holds one branch: its pull request, review comments, changed files, commits and checks. Use it to read your own diff, let an agent turn review comments into commits and send everything back with one push. It works the same on GitHub, GitLab and Bitbucket.

- **Resolve**: Turn review comments into commits without writing the fixes yourself.
- **Review sources**: Read pull request comments and your own notes in one list in the Comments section.
- **Close on GitHub**: Finish a review with Push N fixes in the Branch header.
- **Read the code**: Read the branch against its base in Files, unified or split.

[More on review and resolve on the branch page](docs/features/review.md)

<a id="rewrite-history"></a><a id="safe-apply"></a><a id="conflict-prediction"></a><a id="conflicts-merged-in-a-copy"></a><a id="push-with-lease-and-restore"></a><a id="backups"></a><a id="suggest-a-message"></a><a id="bring-them-into-the-plan"></a><a id="rebase-on-main"></a><a id="after-a-pull-request-merges"></a><a id="shape-the-history"></a><a id="safe-edits"></a><a id="conflicting-edits"></a>

## Commits and history

The Commits section of the Branch page lets you clean up a branch before it goes to review. Fold, move, reword and drop commits live, with Undo and Redo and a backup before every edit.

- **Shape the history**: Clean up a branch by hand in the Commits section.
- **Safe edits**: Undo and Redo, also ⌘Z and ⌘⇧Z, restore edits while the Commits page stays open.
- **Conflicting edits**: A conflicting edit names the file and leaves the branch as it was.

[More on commits and history](docs/features/branch-history.md)

<a id="start-a-workflow"></a><a id="workflow-builder"></a><a id="orchestrated"></a><a id="a-preset-as-the-plan-a-run-starts-from"></a><a id="preset-and-custom"></a><a id="built-in-workflows"></a><a id="runs-of-a-workflow"></a><a id="saved-steps"></a><a id="model-per-step"></a><a id="when-to-ask"></a><a id="autonomy"></a><a id="asks-you"></a><a id="pause-resume-and-skip"></a><a id="run-defaults"></a><a id="workflow-rules"></a><a id="spend-cap"></a><a id="limit"></a><a id="chained-starts"></a><a id="workflow-run"></a><a id="hints-to-the-orchestrator"></a><a id="why-each-step-and-the-run-recap"></a><a id="step-handoff-summary"></a><a id="open-questions"></a><a id="let-an-agent-decide"></a><a id="import-workflows"></a>

## Workflows

A workflow runs several agents in one session, each step with its own role, model and effort. Use it to split a job into steps such as scout, plan, implement and review, and to steer the run while it goes. You choose how much it asks you and how much it may spend.

- **Start a workflow**: A workflow run starts from the New session page: pick Workflow, then Orchestrated or Preset, and press Start workflow.
- **Orchestrated**: Give a goal and a model picks each next step, with its role, model, effort and a reason.
- **Run defaults**: Set what every new run starts with in the Run defaults tab.
- **Workflow run**: Follow a run step by step, with its sub-agents under their agent and one button that moves it on.
- **Limit**: Cap what a run or a session can spend, and choose Pause workflows or Warn only.

[More on workflows](docs/features/workflows.md)

<a id="workspace-chat"></a><a id="ask-in-a-session"></a><a id="images-in-chat"></a><a id="roles"></a><a id="agent-header"></a><a id="what-the-agent-received"></a><a id="agent-transcript"></a><a id="agent-suggests"></a><a id="queue-or-send-now"></a><a id="message-and-document-fields"></a><a id="stop-and-continue"></a><a id="quiet-agents"></a><a id="turn-footer"></a><a id="tool-call-states"></a><a id="composer-plus-menu"></a><a id="attach-files"></a><a id="drift-warning"></a><a id="subagents-from-plan-parts"></a><a id="auto-agent"></a><a id="history-rewriter-and-scribe"></a><a id="one-language-per-session"></a>

## Agents

Talk to agents, watch what they do and steer them while they work. You can ask questions without starting a session, see exactly what each agent was told and cost, and stop or redirect one without losing its work.

- **Workspace chat**: Ask about the workspace without starting a session.
- **Ask in a session**: Ask what is happening in a session without leaving it.
- **Roles**: Give each agent the job it is good at.
- **Agent transcript**: Follow one agent's work as one conversation you can write in.

[More on agents](docs/features/agents.md)

<a id="artifacts"></a><a id="plan-parts-and-run-plan"></a><a id="plan-beside-the-planner"></a><a id="comment-on-a-plan"></a><a id="report-as-a-document"></a><a id="files-on-disk"></a><a id="create-a-wireframe"></a><a id="wireframes-scouted-first"></a><a id="wireframe-versions"></a><a id="compare"></a><a id="ask-for-a-change"></a><a id="import-wireframe-json"></a><a id="revisions-and-restore"></a><a id="save-a-copy-and-new-variant"></a>

## Plans, reports and wireframes

Plans, reports and wireframes live next to the task, not inside a chat. You can read, comment on, version and run them, and every one stays available as a file on disk.

- **Artifacts**: Keep everything a session made in one list.
- **Create a wireframe**: Describe the screen, add attachments, and choose how faithful it is and which device it targets.
- **Compare**: See what changed between two wireframe versions side by side.

[More on plans, reports and wireframes](docs/features/artifacts.md)

<a id="decisions"></a><a id="see-why-each-decision-was-made"></a><a id="running-summary"></a><a id="context-drawer"></a><a id="who-receives-what"></a><a id="learned"></a><a id="explanations"></a><a id="context-budgets"></a><a id="plans-handed-to-the-next-agent"></a>

## Shared context

What one agent learns, the next one reads. The goal, decisions and a running summary travel with the session, so a new agent starts informed instead of from a blank chat.

- **Decisions**: Record a decision once and have the agents after it read it.
- **Running summary**: Hand the next agent where things stand.
- **Context drawer**: Open goal, decisions, summary and explanations from any session page with the Context button, and copy them all with Copy context.
- **Who receives what**: See which agents read each part of the context.
- **Explanations**: Read back what agents explained about the topics you follow.

[More on shared context](docs/features/context.md)

<a id="usage-limits-chip"></a><a id="use-reset"></a><a id="fallback-when-a-limit-is-hit"></a><a id="fallback-order-and-auto"></a><a id="provider-order-and-auto"></a><a id="model-picker"></a><a id="impact"></a><a id="monthly-cap-and-budget-alert"></a>

## Providers, limits and cost

Watch how much of each plan is left, keep work moving when a provider runs out, and see what it all costs. Goodboy shows limits in the top bar and spend in one place, so you decide where work goes before a limit stops it.

- **Usage limits chip**: See how much of your Claude and Codex plans is left before a run stops.
- **Fallback when a limit is hit**: Keep a task moving when a provider runs out.
- **Model picker**: Pick a model with the reason next to it.
- **Impact**: See what Goodboy got done and what it cost over 7 days, 30 days or All time.
- **Monthly cap and budget alert**: Set a monthly cap per provider and hear about it before you reach it.

[More on providers, limits and cost](docs/features/providers.md)

<a id="start-from-scratch"></a><a id="start-a-project-from-nothing"></a><a id="track-a-folder-with-git-later"></a><a id="workspace-with-several-folders"></a><a id="workspace-with-several-projects"></a><a id="starred-folders-descriptions-and-base-branch"></a><a id="starred-projects-descriptions-and-base-branch"></a><a id="worktrees"></a><a id="several-branches-per-repo"></a><a id="several-branches-per-project"></a><a id="workspace-switcher-and-reconnect"></a><a id="repo-status-across-folders"></a><a id="repo-status-across-projects"></a><a id="repository-status"></a><a id="locate-moved-folders"></a><a id="locate-moved-projects"></a><a id="keep-goodboy-out-of-git"></a><a id="branch-names"></a><a id="new-runs-start-as"></a><a id="copy-settings-from-another-workspace"></a><a id="monitoring"></a><a id="workspace-and-projects"></a><a id="new-worktrees-start-usable"></a>

## Workspaces and folders

A workspace keeps your folders together, and one session can work across several of them. Each branch an agent works on gets its own worktree, so agents edit in parallel without touching your checkout.

- **Workspace with several folders**: Keep your repos together as one workspace, and let one session work across several of them.
- **Worktrees**: Let agents edit in parallel without touching your checkout.
- **New worktrees start usable**: A new worktree is a clean checkout, so the folder settings carry what it lacks.
- **Repo status across folders**: See which repos have something to pull, right next to the workspace switcher.
- **Monitoring**: See which ports are taken and by whom.

[More on workspaces and folders](docs/features/workspace.md)

<a id="worktree-folders"></a><a id="branches"></a><a id="storage-scope"></a><a id="artifacts-from-deleted-sessions"></a><a id="goodboy-can-free-n-gb"></a><a id="other-tools"></a>

## Storage

Free disk space and clean up branches, with what is safe to remove spelled out. Goodboy tells you why each folder or branch exists and what removing it costs, so you can clear space without guessing.

- **Worktree folders**: Free disk space from the checkout folders of archived, deleted or gone sessions.
- **Branches**: Delete old branches with confidence.
- **Goodboy can free N GB**: Hear about reclaimable space once, when idle safe folders pass 10 GB or the disk runs low.
- **Other tools**: See how much space the other coding tools keep, without risking their history.

[More on storage](docs/features/storage.md)

<a id="security-findings"></a><a id="findings-kept-out-of-the-export"></a><a id="export-and-import-your-setup"></a><a id="backup-before-a-data-update"></a><a id="newer-data-guard"></a><a id="updates"></a><a id="changelog-in-the-app"></a><a id="before-and-after-pictures"></a><a id="guide"></a>

## Security, backup and updates

Keep tokens out of what you save, move your setup between machines, and update without losing data. Goodboy checks locally, backs up before it changes your data, and tells you what each release does.

- **Security findings**: Catch a token pasted into a saved script before it travels.
- **Export and import your setup**: Move your setup to another Mac, or keep a copy.
- **Updates**: Get updates in the background, then see what is new.

[More on security, backup and updates](docs/features/security.md)

<a id="sidebar"></a><a id="go-anywhere"></a><a id="command-palette"></a><a id="search"></a><a id="right-click-menus"></a>

## Search and navigation

Find any session, message, plan or action, and reach it from the keyboard. One sidebar holds every place you go, and **⌘K** and **⌘F** cover the rest.

- **Sidebar**: Every place you go sits in one sidebar on the left.
- **Go anywhere**: Reach any screen without the mouse.
- **Command palette**: Press ⌘K to act on what you are looking at.
- **Search**: Find a message, a plan, a decision, an issue or a branch with ⌘F.

[More on search and navigation](docs/features/search.md)

<a id="terminal"></a><a id="keyboard-shortcuts-back-and-forward"></a><a id="script-drawer"></a><a id="open-in-editor"></a><a id="explore"></a>

## Keyboard and terminal

Drive Goodboy from the keyboard, run a shell in the session's worktree, and open the code in your own editor. Scripts, files and terminals sit next to the session, so you rarely leave the app to check on them.

- **Terminal**: Open a real login shell in the workspace folder or any linked worktree.
- **Keyboard shortcuts, back and forward**: Move through Goodboy, change a shortcut and stop an agent without leaving the keyboard.
- **Explore**: Browse the session folder as a file tree, with a preview of the selected file beside it, Open and Copy.

[More on keyboard and terminal](docs/features/keyboard.md)

<a id="report-a-bug"></a>

## Support Goodboy

The best support is running Goodboy on the work you already have. When something feels off, or you have an idea, report it from inside the app in one line.

- **Report a bug**: Tell us what broke in one line.

[More on supporting Goodboy](docs/features/support.md)

<a id="also-there"></a>
