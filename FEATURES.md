# Goodboy features

The full feature guide, in the same order as [goodboy-ai.dev](https://goodboy-ai.dev): set up, start a task, move between tasks, ship the code, then keep an eye on cost and disk. Each entry says what the feature does for you and how you use it.

Most pictures follow one team and one task. Harborline keeps three repos, payments-api, ledger-core and notify-relay, and issue HBL-412 says retried webhooks post a second credit. The pictures show that fix from the first brief to pull request #318.

- [Set up](#set-up)
- [Start a task](#start-a-task)
- [Overview and activity](#overview-and-activity)
- [Switch between tasks](#switch-between-tasks)
- [Search and navigation](#search-and-navigation)
- [Workspace and projects](#workspace-and-projects)
- [Branch history](#branch-history)
- [Review, resolve and pull requests](#review-resolve-and-pull-requests)
- [The board](#the-board)
- [Workflows](#workflows)
- [Inbox and your tools](#inbox-and-your-tools)
- [Plans, reports and wireframes](#plans-reports-and-wireframes)
- [Shared context](#shared-context)
- [Providers, limits and cost](#providers-limits-and-cost)
- [Storage](#storage)
- [Security, backup and updates](#security-backup-and-updates)
- [Agents](#agents)
- [Support Goodboy](#support-goodboy)
- [Keyboard and terminal](#keyboard-and-terminal)
- [Also there](#also-there)

## Set up

Get from install to a first agent: connect a provider, check what it can do, link your tools and tell agents who you are.

### Welcome to Goodboy

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-welcome-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-welcome-light.webp" alt="The Welcome to Goodboy screen: a Setup stepper with Provider, Project, Code host, Tasks and First session, the line Five short steps, then an agent reads your project, four rows with their time, and a Get started button">
</picture>

Follow five short steps from install to a first agent reading your project: **Provider**, **Project**, **Code host**, **Tasks** and **First session**. Code host and tasks are optional, steps that do not apply to you are skipped, and **I've used Goodboy before: skip setup** takes you straight in. The last step hands you a session draft already filled in.

### Provider connection

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-connection-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-connection-light.webp" alt="The Provider step of setup: Claude marked Connected, Cursor Not signed in with a Connect button, Codex with an Error status and a Connect button, and Gemini Not installed with a Set up manually button">
</picture>

Pick the provider you already pay for and connect it with a login or an API key. Each card says what the provider needs and where it stands: **Connected**, **Not signed in**, **Not installed**. **Connect** walks you through the sign-in, and **Open the sign-in page again** helps when no browser tab opened. You can add more providers later.

### One page per provider

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-page-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-provider-page-light.webp" alt="The Claude page in Settings under Providers and models: Usage with a Weekly bar at 84% used, Models in the picker showing Haiku, Sonnet, Opus and Fable, Permissions with Claude, and Account signed in as harborline-platform on the Max plan">
</picture>

Find everything about a provider on its own page in **Providers & models**: **Usage** with the weekly window, **Models in the picker** with a switch per model, **Permissions**, and **Account** with **Sign in again** and **Disconnect**. Providers billed per token say so instead of showing usage windows.

### Update the provider CLI

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-cli-update-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-cli-update-light.webp" alt="The top of the Claude page with a banner reading Opus 5.5 needs a newer Claude CLI, You have Claude CLI 2.1.260, Update to 2.1.280 or newer, and an Update Claude CLI button">
</picture>

See when a model needs a newer CLI, right at the top of the provider page, and press **Update Claude CLI** to install it. The update waits for running turns to finish. A turn the CLI refuses retries on the closest model in the same family.

### Permissions for each provider

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-permissions-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-permissions-light.webp" alt="Workspace Permissions in Settings: four default modes (Read only, Ask first, Edits allowed, Full access) and a table of what Claude, Codex, Cursor, Gemini and OpenCode family each do with them, marked Works, Partly, Runs Read only or Ignored, plus Rules and Role limits rows">
</picture>

Check which permission modes a provider can honor before you pick one: **Read only**, **Ask first**, **Edits allowed** and **Full access**. The table marks each cell as **Works**, **Partly** or **Runs Read only**, with the reason underneath, and adds a **Rules** row and a **Role limits** row. A mode a provider cannot honor never runs looser: **Ask first** on Codex runs as **Read only**. The default mode for new sessions sits above the table.

### Integrations

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-integrations-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-integrations-light.webp" alt="Settings under Integrations, 5 of 7 connected: GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack in the left list with a status dot each, and the Linear page open showing Connected as Dana R. on linear.app/harborline">
</picture>

Connect GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack from one page. The list shows the account behind each tool and how many are connected, and each tool opens to its own page. Give a project a different account than its workspace when you need to. Keys stay in your system credential store.

### About you

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-about-you-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/setup-about-you-light.webp" alt="The About you section of workspace settings with four fields: Your roles (Tech Lead, Backend Engineer), About your work, How agents should work with you, and Explain more when it touches (Rust), with a See who reads what link">
</picture>

Tell agents once who you are and how you like to work, in four short parts: **Your roles**, **About your work**, **How agents should work with you** and **Explain more when it touches**. **See who reads what** shows which role reads each part.

## Start a task

Begin from an issue, a workflow or a question, in one draft that turns into a session when you press Start.

### How do you want to start?

The **New session** draft has three tabs: **Pick up a task**, **Run a workflow** and **Ask an agent**. **Discard draft** throws it away. The draft becomes a session only when you press Start, so empty sessions do not pile up.

### Pick up a task, with a drafted brief

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-pick-task-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-pick-task-light.webp" alt="New session with the Pick up a task tab selected, a Starred list of issues with HBL-412 Retried webhooks post a second credit highlighted, and below it Brief from HBL-412 titled Stop retried webhooks posting a second credit, with Done when criteria and the buttons Dismiss, Use issue text, Edit and Use brief">
</picture>

Turn an issue into a briefed session in one pick. Pick HBL-412 and Goodboy drafts a short title, a goal and the **Done when** criteria under **Brief from HBL-412**, and the full issue stays linked to the session. Press **Use brief** to keep it, **Edit** to change it, or **Use issue text** to skip the draft. A Sentry error or a GitHub issue opens in the project it belongs to, and one Start links the issue, creates the session and starts the work.

### Run a workflow

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-run-workflow-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-run-workflow-light.webp" alt="New session with the Run a workflow tab selected: an Orchestrated workflow with the goal Stop retried webhooks posting a second credit, the Orchestrated, Custom and Preset switch, the Plan with an Orchestrator row and example steps Scout, Planner and Implementer, and the Starts Now, Autorun and Spend cap None controls next to Start workflow">
</picture>

The full workflow builder, right in the kickoff. Write the goal, pick **Orchestrated**, **Custom** or **Preset**, and read the **Plan** you will run. Under the plan, set **Starts**, **Autorun** and a **Spend cap**. **Start workflow** creates the session and starts the run in one step.

### Ask an agent

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-ask-agent-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-ask-agent-light.webp" alt="New session with the Ask an agent tab selected: a question field reading How does a retried webhook reach the ledger?, the Scout, Auto and payments-api choosers, the note Scout only reads. It changes nothing., and the Start Scout button">
</picture>

Map an unfamiliar repo before you plan. **Scout** is the default and only reads, so it changes nothing. Type an area, a file or a question, choose the model and the project, and press **Start Scout**. With an empty field it runs on the whole project. On a broad question the scout can split the search by area, and one report merges what the child scouts found.

### Start blank

Start from the goal instead. **Start blank** sits in the header of every tab and opens the session straight on its Overview, where you add the goal, projects and work.

### Named by Goodboy

Get a short title without writing one. A new session is named for you and marked **Named by Goodboy** until you rename it.

## Overview and activity

Open a session and read everything about the task in one place: its goal, its projects, and the timeline of what happened.

### Session overview

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-session-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-session-light.webp" alt="The overview of the session Stop retried webhooks posting a second credit, with Context, Questions 1 and Artifacts 2, the linked pull request #57, HBL-412 and PAYMENTS-API-3F2, a cost of $3.47, and the projects payments-api (pull request #318 In review) and notify-relay (pull request #57 In review), above an Activity header with Filter, Open run and Start agent">
</picture>

Find the goal, linked issues, projects, cost and the buttons to start an agent or a workflow on one screen. Each project lists its branches with their changes and pull request state. **Run workflow** turns into **Open run** while a run is live, so a second one does not start on top.

### Refresh a session

See pull requests made outside Goodboy without reloading. One an agent opened or you made in a terminal shows up when the turn ends or when you come back to the window. **Refresh**, the first icon at the top right of the session header, next to Archive and Delete, re-reads projects, branches and pull requests right away. **⌘⇧R** and the command palette do the same.

### Activity

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-activity-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-activity-light.webp" alt="The Activity timeline of the session: a report titled Webhook redelivery no longer double credits, the step Report the session outcome on Sonnet 5, a queued step Cover the console retry states on Haiku 4.5 with a range of 11 to 14 minutes, the question Which failures should count toward a stuck delivery? with an Answer button, the step Add the stuck-delivery banner marked Needs you on Kimi K3, and Decisions 1 replaced, 1 withdrawn, and #311 merged">
</picture>

Read the whole session as one timeline of agents, workflows, questions, fixes, artifacts, pull requests and decisions. Each step shows provider, model, time and cost in the same columns. A question sits on its own row with **Answer** beside it, and the step it blocks is marked **Needs you**. **Filter** trims what the timeline shows.

### Next

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-next-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-next-light.webp" alt="The Next row of a session: the plan Show the attempts on each delivery, marked Ready to implement, with a Start implementer button and a more menu">
</picture>

Know the one move that unblocks a task, like answering a question, fixing a failing check or opening a pull request. Here the plan **Show the attempts on each delivery** is ready, and **Start implementer** starts it. **Not now** in the row menu puts a suggestion away until the situation changes.

### Time left

See how long a step has left, learned from your own past runs. Queued steps show a range, like the **~11-14m** on **Cover the console retry states** in the timeline above. A slow run says "Longer than usual", and thin history shows a count instead of a guess.

### File versions

Undo an agent's edit in a session without a branch: each file it changed is kept as it was, with **Restore**.

## Switch between tasks

Move between the tasks of a workspace, and see from any screen which one needs you.

### Activity bar

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-rail-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-rail-light.webp" width="420" alt="The activity bar of the Harborline workspace: sessions grouped under Building 2, Running 2, Needs you 1 and In review 1, with Stop retried webhooks posting selected, 1 to answer and HBL-412">
</picture>

Move between tasks without losing your place. The bar on the left of every session lists all the sessions of the workspace, grouped by where they stand: **Building**, **Running**, **Needs you** and **In review**, with done work folded away. Each row says what it is waiting on, like **1 to answer** or **draft PR #90**, so you open the one that needs you, and its Overview shows what ran, what was decided and what comes next.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-display-options-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-display-options-light.webp" alt="The Display options menu of the activity bar, open over the Harborline sessions, with Sort by Recent, Oldest and A-Z, and Group by Stage, Pull request and None">
</picture>

The **Display options** button at the top of the bar sorts sessions by **Recent**, **Oldest** or **A-Z**, and groups them by **Stage**, **Pull request** or **None**. The filter button next to it narrows the bar to one project.

### Now chip

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-now-chip-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-now-chip-light.webp" alt="The top bar chip 1 need you, 2 running opened into the panel Now in Harborline: NEEDS YOU 1 with Fix the rounding drift in the settlement export, and RUNNING 2 with Speed up the payout export for large merchants and Stop retried webhooks posting a second credit">
</picture>

Know what needs you from any screen. The chip in the top bar counts sessions that need you, running sessions and running scripts. Click it to open **Now in Harborline**, which lists each one, and click a row to jump to that session.

### Notifications

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-notifications-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/switch-notifications-light.webp" alt="The Notifications page for Harborline: All notifications, 6 notifications, 4 unread, with Pull request opened for payments-api #318, Session reached 80% of its cap with an Open spend button, Handoff degraded, and 1 session folder left on disk with a Review storage button, and a left column of views, severity, source and workspace filters">
</picture>

Catch up in one place. Everything Goodboy has to tell you, from a pull request opened to a session close to its spending cap, lands in one list: a bell with an unread count, and a page grouped by severity, source and workspace. **Unread** and **Needs action** cut it down, and a row that needs you carries its next step, like **Open spend** or **Review storage**.

### Open in new window

Give each workspace its own window, so switching does not interrupt running agents. A workspace that is already open brings its window forward instead of opening twice. After a reload or an update, and on every launch with **Reopen last workspace on launch** on, every window comes back on the screen, tab and panel it showed.

## Search and navigation

Find any session, message, plan or action, and reach it from the keyboard.

### Go anywhere

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-go-anywhere-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-go-anywhere-light.webp" alt="The palette after typing webhook: Ask in Chat, then Jump to with two sessions named Stop retried webhooks posting a second credit (payments-api and notify-relay) and the Replay a webhook event script, with the details of the first session on the right">
</picture>

Reach any screen without the mouse. **⌘K** opens on what you are looking at, and a few letters find any session of any workspace, an agent, a plan, a page or a script. The row you highlight shows its stage, project, branch and pull request on the right, and **Enter** opens it. **⌘F** switches the same window to search.

### Command palette

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-command-palette-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-command-palette-light.webp" alt="The command palette on the agent Resolve review on payments-api#318: For this agent lists Show its changes, Message this agent, Change model, Copy name and Delete agent, and For this session lists Open Review, Open Diff and Open Terminal with their shortcuts">
</picture>

Press **⌘K** to act on what you are looking at. The verbs of the open agent come first under **For this agent**, then **For this session** with the shortcut of each action, and **→** shows every action of any row. Results are ranked by how well they match and how often you use them, and the composer's prefixes work here too. Any search with text starts with **Ask in Chat**, which opens a new chat with what you typed as its first message.

### Search

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-overlay-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-overlay-light.webp" alt="Search for credit in the session Stop retried webhooks posting a second credit: two messages, the session, the plan Dedupe on the event id, the issue HAR-231 and pull request 318 as results, the filters Type, Project, Provider, Status and Date above them, and the picked message with Open in transcript and its actions on the right">
</picture>

Find a message, a plan, a decision, an issue or a branch with **⌘F**. Search starts in the open session and **⌫** widens it to the workspace, then to everything. Narrow the results with **Type**, **Project**, **Provider**, **Status** and **Date**, and pick a hit to see its details and actions. **Open in transcript** lands on it in context. The index stays on your computer.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-jump-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/search-jump-light.webp" alt="The session transcript after opening a hit, with credit highlighted in the messages and a find bar reading credit, 2 of 3, with previous, next and close buttons">
</picture>

Once you land on a hit, walk the other matches in that view with **⌘G**.

### Right click menus

Right click a session, agent, run, artifact, pull request, worktree row, diff file or message to see every action it has, at the pointer. The **⋯** menu and the palette list the same actions in the same order, and one that cannot run says why. **Shift+F10** opens the menu on the focused row.

## Workspace and projects

Keep your repos together, and let sessions work across them.

### Workspace with several projects

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-several-projects-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-several-projects-light.webp" alt="The Northwind workspace with one session open: its Projects section lists api on the branch feat/create-orders-endpoint and storefront-web on feat/checkout-orders-api, each with New worktree and its changes, above the activity timeline">
</picture>

Keep your repos together as one workspace, and let one session work across several of them. The **Projects** section of the session lists each repo it touches, with its branch, the size of its changes and **New worktree**. A project gets a branch only when an agent needs to edit it.

### Starred projects, descriptions and base branch

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-starred-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-starred-light.webp" alt="The Harborline workspace settings, Projects 4: Starred ledger-core and payments-api with a one-line description each and the base branch main, then All projects with notify-relay and runbooks, and a note that starred projects come first for agents">
</picture>

Point agents at the right repo without naming it. Star a project and give it a one-line description: both go into each agent's brief, and starred projects come first in the project pickers. Each repo shows its base branch, **main** here, read from origin.

### Worktrees

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-worktrees-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-worktrees-light.webp" alt="The Projects of one session: ledger-core with three worktrees (idempotent-postings, part 3 of 6, pull request 418 in review; statement-backfill, part 5 of 6, Files kept with Reopen; rounding-drift, part 1 of 6, pull request 412 merged with Remove worktree) and notify-relay with pull request 96 in review">
</picture>

Let agents edit in parallel without touching your checkout. Each branch gets its own worktree, a separate folder next to your checkout with its own changes and pull request, and every row shows its part, its lines changed and its pull request. **New worktree** adds one, **Remove worktree** clears a merged one, and **Reopen** brings back one whose files were kept. **Copy worktree path** in **⌘K** copies where a session works, or lets you pick one when it has several, with **⌘Enter** to copy them all.

### Several branches per project

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-branches-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-branches-light.webp" alt="The Projects of one session where two worktrees are on another branch than the one recorded: ledger-core has two branches and offers Check again, and notify-relay offers Keep both branches and Use this branch here">
</picture>

Work on several branches of one repo in the same session: ledger-core shows two, each in its own worktree. If a worktree drifts to another branch, a card says the project is not on the branch it was left on and offers **Use this branch here** or **Keep both branches**, which opens the original branch again in a worktree of its own. When git already has that branch checked out in another worktree, the card offers **Check again** instead.

### Workspace switcher and Reconnect

Jump between workspaces and projects from one search. Disconnecting a workspace keeps its history, and adding its folder again offers **Reconnect**.

### Repo status across projects

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-repo-status-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-repo-status-light.webp" alt="The 3 repos popover of the board: 1 behind and 1 uncommitted, an Update 1 button, payments-api 2 behind, notify-relay 1 uncommitted and ledger-core up to date" width="746">
</picture>

See which repos are behind, uncommitted or diverged from the **N repos** popover in the board header, and update the safe ones together with **Update 1**. Updates are fast-forward only and leave dirty or diverged repos to you. **Check origin** refreshes the list.

### Locate moved projects

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-locate-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-locate-light.webp" alt="The Harborline workspace settings with a warning, 3 projects are not where Goodboy left them, and a Locate folders button, above the project list where each repo reads Folder not found">
</picture>

Moved your repos to a new folder? The warning in the workspace settings names the projects Goodboy cannot find, and their sessions wait. Choose **Locate folders**, pick the parent folder, and Goodboy finds them, fixes the stored paths and repairs the worktrees, with **Undo move**. Repos are matched by their first commit and remote, not by folder name.

### Keep .goodboy out of git

Keep Goodboy's own folder out of your commits with one click. The card shows up only when git does not already ignore `.goodboy`, your global rules included.

## Branch history

Reshape a branch before it goes to review: fold, move, rename and remove commits, see what would conflict, and apply with a backup one click away.

### Rewrite history

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-rewrite-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-rewrite-light.webp" alt="Rewrite history for payments-api hl/ledger-export: seven commits of your own listed Now, with fold and combine controls (Keep title, Keep both, Separate) and a Start from today's main button, next to the four commits the branch becomes After Apply, with a color legend underneath">
</picture>

Clean up a branch by hand. Drag a commit between two others to move it, drop it onto another to fold it in, or rename or remove it. **Start from today's main** moves the branch start onto the latest main. A folded commit chooses **Keep title**, **Keep both** or **Separate** in one control, and hovering any commit of a fold highlights the whole group. The branch is drawn as it is **Now**, next to what it becomes **After Apply**, with a color for each kind of change. Each row's buttons, its `⋯` menu, a right click and **⌘K** on the focused row offer the same actions.

### Safe apply

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-trial-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-trial-light.webp" alt="Planned changes, 5 changes turning 7 commits into 4, with the notice Trying your changes on a temporary copy, Your branch is untouched until this finishes, and a progress bar at Step 3 of 7, Add retries to the export job, above the Apply here only and Apply and update online buttons">
</picture>

**Apply here only** and **Apply and update online** try the whole plan on a temporary copy first and check the result before your branch moves. A progress line names the step it is on, and a backup is saved before anything changes. If a step stops, it says which one and why, and your branch stays exactly as it was.

### Conflict prediction

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-conflicts-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-conflicts-light.webp" alt="Planned changes with four changes marked may conflict, and the warning 4 changes do not replay cleanly: webhook.ts is changed by more than one commit, with a Rewrite with an agent button">
</picture>

While you edit the plan, Goodboy tries it in memory and marks each change that may conflict. A warning names the file, here `webhook.ts`, and how many changes would not replay cleanly. Your checkout stays as it is.

### Conflicts merged in a copy

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-stopped-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-stopped-light.webp" alt="The notice Nothing was changed: a step does not replay cleanly, Step 3 of 7, Add retries to the export job, conflicts in webhook.ts, Your branch is exactly as it was, with Rewrite with an agent and Dismiss buttons above the list of five planned changes">
</picture>

When a step stops on a conflict, the notice says which step and file, and your branch is untouched. Click **Rewrite with an agent** to let the History rewriter merge the conflict in a copy. Goodboy checks the result before anything moves.

### Push with lease and restore

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-result-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-result-light.webp" alt="History rewritten, 7 commits became 4, listing the five changes made, Online copy updated with a safe force push and PR #214 shows the new version, a backup of hl/ledger-export with Copy ref, and the Restore it and Done buttons">
</picture>

**Apply and update online** replaces the online branch only when nothing newer is there, so a teammate's push is never overwritten. The result lists what changed and confirms the online copy. **Restore it** takes the old history back, and the backup stays for 30 days.

### Backups

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-backups-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/history-backups-light.webp" alt="Rewrite history for payments-api hl/fix-duplicate-credit with the Backups panel open, one backup, Dedupe webhook retries in the handler from 1d ago, and a Restore previous history button">
</picture>

Open the `⋯` menu and choose **Backups** to see the older histories of this branch. **Restore previous history** puts one back, and **Hide** closes the list.

### Suggest a message

Get a commit message drafted for a squash or a reword. Scribe writes it in place, and you can edit it before you apply.

### Bring them into the plan

Someone pushed after you applied? Goodboy lists their new commits and offers to add them to the plan and push again.

### Rebase on main

Rebase on main with the same engine, and bring in an agent only when there is a conflict.

### After a pull request merges

Decide what happens to a merged branch, **Ask me**, **Delete on this Mac** or **Also on origin**, per workspace or project, with 14 days to restore it. A branch with later commits, uncommitted changes, or one Goodboy did not create is left alone.

## Review, resolve and pull requests

Turn review comments into commits, push them back to GitHub, and read your own pull requests and diffs before anyone else does.

### Resolve

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-resolve-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-resolve-light.webp" alt="Review for PR #318 in Harborline with six open comments on the left and the one from kenji-w on retryPolicy.ts:42 on the right, marked Ready, with a Proposed change that caps the retries in retryPolicy.ts and metrics.ts">
</picture>

Turn review comments into commits without writing the fix yourself. **Review** lists the comments on the left and the one you picked on the right: here kenji-w asks for a retry cap on `retryPolicy.ts:42`, and the resolver's **Proposed change** sits under it. **Draft a fix** (**Draft fixes for N** when several are waiting) has an agent write each fix as a local commit and draft the reply, then you accept it, edit it, reply yourself or skip the comment.

### Comment states

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-comment-states-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-comment-states-light.webp" alt="The Review list for PR #318 grouped as Open 6, Waiting for the push 2 and Done 1, with each row marked Outdated, Needs you, Drafting, Ready, Not started, Accepted, Skipped or Pushed, and a row of count chips above">
</picture>

Know what each comment needs next. Each row carries a state: **Outdated**, **Needs you**, **Drafting**, **Ready**, **Not started**, **Accepted**, **Skipped** or **Pushed**. Rows group as **Open**, **Waiting for the push** and **Done**, and the chips above the list count them, such as **2 ready** and **1 pushed**. An **Outdated** comment changed since its reply was drafted, so **Redraft** comes first.

### Close on GitHub

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-push-confirm-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-push-confirm-light.webp" alt="The Review header of PR #318 with a confirm under it: Push 1 to hl/fix-duplicate-credit, 1 fix in 1 new commit, 1 reply, 1 thread resolved on GitHub, 2 comments need you first, with Cancel and Push buttons">
</picture>

Finish a review in one action. **Push 1** in the Review header opens a confirm right under it: **Push 1 to hl/fix-duplicate-credit?**, with the count of fixes, replies and threads it will resolve on GitHub, and a note when comments still need you. **Push** pushes the fixes, posts the replies and resolves the threads. **Cancel** leaves everything as it was. After an interruption Goodboy looks for your reply in the thread before posting it again.

### Review replies in your voice

Get replies that sound like you, **Terse**, **Friendly**, **Formal** or **Like my replies**. **Like my replies** reads your last 20 review replies and writes a style note you can edit.

### Fixes on a branch that moved

Accept a fix even after the branch got new commits: it lands on top of the latest one, and on a conflict the branch goes back to its old head.

### Notes before a pull request

Review your own diff before anyone else does. Leave notes on lines, resolve them like review comments, and post the open ones to the pull request later.

### GitHub pull request page

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-pr-page-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-pr-page-light.webp" alt="The page of pull request #318, Stop retried webhooks posting a second credit, marked In review with a Squash and merge button, 9 comments to resolve with Open Review, Changes on this branch +47 -12 with Open diff, Review Approved, Checks 3 of 3 passing and the typecheck, unit tests and lint checks">
</picture>

Know whether a GitHub pull request can merge, in plain words, with details and checks, and merge, mark ready, draft or close it from there. The page shows **Status**, **Review**, **Branch** and **Checks** (**3 of 3 passing**), then the title, description, reviewers and each check. The next step is the one main action, such as **Mark ready for review** on a draft or **Squash and merge** once it is approved and green. **Merge** and **Close** confirm right under the header, and **9 comments to resolve** opens Review with **Open Review**.

### Pull request, Diff and Review as layers

Move between a pull request, its Diff and its Review without losing your place. They open as one path in the trail from the worktree row, such as **Overview**, **Pull request**, **#318** at the top of the page above, and Back walks it. Every link to a pull request lands on its page.

### Write it for me

Get a pull request title, description and changelog entry in your repo's format when you open a pull request. Linked issues become closing references.

### PR description follows the push

Keep a pull request description in step with its branch. After a history push, a description Goodboy wrote is updated to match, unless you edited it.

### Diff

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-diff-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-diff-light.webp" alt="The Diff of payments-api on hl/fix-duplicate-credit, branch vs main with 3 files +47 -12, 1 of 3 viewed, Unified and Split, an open note under line 26 of applyWebhook.ts, 1 note, and Resolve in Review and Rewrite history buttons">
</picture>

Read changes with syntax colors, word-level highlights, a **Unified** or **Split** view and a **Viewed** tick per file (**1 of 3 viewed** here), and quote a line into a note or a question for an agent. A note shows under its line with **Resolve** and **Delete**, and **Resolve in Review** in the toolbar carries the notes into Review. The header offers the next step for the branch, such as **Rebase on main**, **Push N commits** or **Create PR**, next to **Rewrite history**.

### Write review

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-write-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/review-write-light.webp" alt="The Write review form under a diff: Line comments 1 for src/webhooks/applyWebhook.ts:26, a Verdict of Comment, Approve or Request changes, an optional Summary, and a Submit comments button" width="800">
</picture>

Review someone else's pull request in a form under the diff, opened with **Write review** on its pull request page. It lists your **Line comments**, a **Verdict** (**Comment**, **Approve** or **Request changes**) and an optional **Summary**. The button under it reads **Submit comments**, **Approve** or **Request changes** to match the verdict, and GitHub shows it as one review. Outdated drafts are marked **Stale**.

## The board

The board shows every session of a workspace by stage. Workflows chain agents into one run you can steer.

### Stage board

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-stage-light.webp" alt="The Harborline board with 11 sessions in four columns: building 3, running 2, needs you 2 and in review 2, with the New session button and the Done and Archived icons at the right">
</picture>

See where each task stands without moving cards around. Each session sits in **building**, **running**, **needs you** or **in review** based on what is happening in it. Finished sessions fold into the icons at the right edge.

### Session card

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-card-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-card-light.webp" alt="Two session cards: Fix the rounding drift in the settlement export with 1 open question, and Stop retried webhooks posting a second credit with PR #318 awaiting review, each with project and issue chips, cost and age" width="692">
</picture>

Read a task at a glance: the pull request or status line, the agent count, project and issue chips, cost and age. A colored bar on the left shows the stage. When one action is waiting, a round button opens it, like **1 open question** on the first card.

### Done and Archived dock

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-dock-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/board-dock-light.webp" alt="The needs you and in review columns with the dock widened on hover, showing Done 2 and Archived 2" width="732">
</picture>

Keep finished work out of the way but close by. Done and archived sessions fold into two icons at the side of the board. Hover them to read **Done** and **Archived** with their counts, and click one to open its column.

### Bulk select

Tidy many sessions at once. Lasso or modifier-click cards across columns, then use **Archive**, **Restore** or **Delete** on the selection together.

## Workflows

A workflow runs several agents in one session, each step with its own role, model and effort.

### Workflow builder

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-builder-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-builder-light.webp" alt="The workflow builder for Duplicate credit fix: a goal, the Orchestrated, Custom and Preset modes, the plan preview with the Orchestrator row on GPT-5.6 Sol, guidance, Starts Now, Autorun, Spend cap and Start workflow">
</picture>

Shape a run before it starts: a name, a goal and a mode, with the plan previewed as the tree the run will show. **Starts**, **Autorun** and **Spend cap** sit under the plan.

### Orchestrated

Give a goal and let a model pick each next step, with its role, provider, model, effort and a reason, until it says done or blocked. The **Orchestrator** row holds its own model and an optional **Guidance** box.

### Preset and Custom

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-builder-custom-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-builder-custom-light.webp" alt="The workflow builder in Custom mode: Describe the steps, Auto and Generate plan, the Draft with planner button, an Add step row and the Save as preset switch next to Start workflow">
</picture>

Write the steps yourself with **Add step**, describe them and press **Generate plan**, or press **Draft with planner**. **Save as preset** keeps what you changed.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-builder-preset-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-builder-preset-light.webp" alt="The workflow builder in Preset mode with the Pick a preset list open: Trace and fix, Harden an endpoint and Migrate a contract, each with a description and its step dots">
</picture>

In **Preset** mode, pick a saved sequence from the list and edit any step before starting.

### Built-in workflows

Start from **Refactor**, **Plan and ship** or **Fix a bug**. A built-in you delete stays deleted until you press **Restore built-in workflows**.

### Saved steps

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-studio-steps-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-studio-steps-light.webp" alt="The Workflows studio on the Saved steps tab: the 8 built-in steps Scout, Investigate, Plan, Implement, Test, Review, Resolve comments and Update docs, and an empty This workspace list with a New step button">
</picture>

Reuse steps across workflows. The 8 built-in steps are read-only, and **Save a copy** makes your own.

### Model per step

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-model-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-model-light.webp" alt="The model picker open on the Orchestrator row of the workflow builder, with the provider icons and the Model, Version, Variant and Effort rows set to GPT, 5.6, Sol and High">
</picture>

Put a light model on a scout and a strong one on the planner. Each step has its own provider, then **Model**, **Version**, **Variant** and **Effort**, and Goodboy records what actually ran.

### Autorun

Let a run move to its next step without you, per run or for the whole session. A guard stops an agent after 4 unattended turns in an hour, and anything you write to it resets the count.

### Spend limit

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-spend-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-spend-light.webp" alt="The Spend cap popover in the workflow builder, switched on at $12, with Pause workflows and Only warn me, and the Spend cap chip reading $12.00 · Pause">
</picture>

Cap what a run or a session can spend, and choose **Pause workflows** or **Only warn me**. A paused run offers **Raise limit**.

### Chained starts

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-starts-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-starts-light.webp" alt="The Starts menu of the workflow builder open with Now, Manually and After Harden an endpoint">
</picture>

Line work up behind work. **Starts** takes **Now**, **Manually** to keep the run queued until you start it, or **After** followed by a workflow name, which starts once that workflow completes.

### Workflow run

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-run-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-run-light.webp" alt="The Duplicate credit fix run on HBL-412: three scouts working in parallel under step 1, then a planner, two implementers and a tester, each on its own model, with Waiting on step 1 above the tree and $0.13 spent of the $12.00 spend limit">
</picture>

Follow a run as a tree with one pinned next action, and add steps to a live or finished run. Parallel scouts appear as branches under their step. Deleting a run deletes its agents and their open questions with it.

### Hints to the orchestrator

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-hints-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-hints-light.webp" alt="The orchestrator strip on step 4 with the Tell the orchestrator something box, Queue and Read now, a queued hint reading Replay the event from the Sentry trace before the tester signs off, and Show read (2)">
</picture>

Steer a run while it goes. **Queue** waits for the next decision, and **Read now** stops the step in flight, keeps what it wrote and decides again. A queued hint shows **Waits for the next decision**, and read ones show the step they were read at.

### Why each step, and the run recap

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-recap-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-recap-light.webp" alt="The Recap of the Duplicate credit fix run, its Goal, and the Why each step list with 5 decisions, from Replay one event three times back to Trace where a retried webhook posts">
</picture>

See why each step was picked, with a short **Recap** of what is done and what is left, rewritten after each decision.

### Step handoff summary

Start each step from a short brief instead of the whole previous chat. If the summary fails, Goodboy keeps the start and end of the chat and marks the brief as degraded.

### Open questions

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-questions-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-questions-light.webp" alt="The Questions lens: 3 waiting and 1 blocking in a Waiting on you list, and the question Which queue should the delivery retries run on? from the Add the stuck-delivery banner agent, with the file src/deliveries/retry.ts and the answers Dedicated retry queue (Recommended), Shared jobs queue, Retry in process and Something else, plus Let an agent decide, Skip and Answer">
</picture>

Get each question as one card: who asks, whether it is **Blocking**, the question, and its answers as numbered tiles with the recommended one tagged. Pick with a number key, answer with **Enter**, or write something else in line. The Questions lens lists what waits on you next to the question you are answering, and **j** and **k** move through the list. The same card sits at the end of the transcript and at the top of the agent's Brief. The answers to one agent go out together once you answered its last question, and until then each one keeps an Undo. A blocking question holds its step until you answer. Each question shows once in the session activity, on the row of the agent that asked, and **Answer** on a workflow row opens that agent right at its question.

### Let an agent decide

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-question-agent-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workflow-question-agent-light.webp" alt="The Brief of the agent Reuse the token footer in the brief with its blocking question open on Let an agent decide: An agent decides with Sonnet 5 · Medium, a hints box, Cancel and Hand off">
</picture>

Hand a question to another agent with a hint and a model from **Let an agent decide**, then press **Hand off**. Its answer counts as yours, and **Answer it yourself** takes it back.

### Import workflows

Bring custom workflows over from your other workspaces with **Import** in the Workflows studio.

## Inbox and your tools

Connect your trackers, code hosts and Slack once. Their work lands in one Inbox, and agents can read and act on it.

### Supported tools

Connect the ones you use in **Settings**, **Integrations**. Each one feeds the Inbox and can start a session with its brief drafted.

- **GitHub**: issues and pull requests, review comments you resolve with an agent, and the pull request page
- **GitLab**: issues and merge requests, with threaded discussions, replies, approvals and merge
- **Bitbucket**: pull requests, with comments, approvals and merge
- **Jira**: issues you comment on, assign, edit and move between statuses
- **Linear**: issues you comment on, assign, edit and move between states, with threaded replies
- **Sentry**: errors with stack trace, breadcrumbs and tags, ready to hand to an agent
- **Slack**: threads from the channels you pick, where agents read, reply and react, and replies wait for your OK by default

### Agents use your tools

Let agents on any provider read and act on GitHub, GitLab, Bitbucket, Jira, Linear, Sentry and Slack, as far as you connected them, without handing them your keys. The agent asks Goodboy over a local socket only your user can open, and Goodboy makes the call.

### Inbox

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-list-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-list-light.webp" alt="The Inbox listing 10 items from Linear, GitHub, Jira, Sentry and Slack in Today, Yesterday and Older groups, with the View, Type, Source and Project filters and the key hints on the left, and Linear issue CAS-231 open on the right with Launch session and Link to a session">
</picture>

Work from one list instead of seven tabs. Issues, Slack threads and Sentry errors from your connected tools sit together, grouped by day, next to pull requests from GitHub (review requests and your own recent ones) and merge requests from GitLab and Bitbucket. Narrow the list by **View**, **Type**, **Source** and **Project**, and move with **j** and **k**. Sentry errors filter by the project they belong to, and GitHub or GitLab items too when several projects live on that host. Linear and Jira stay one flat list.

### Find any issue by code or link

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-lookup-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-lookup-light.webp" alt="The Inbox search box holding HBL-412, with the Linear issue Retried webhooks post a second credit listed under Not in your inbox, Assigned to Dana R., and its details open on the right">
</picture>

Paste `HBL-412`, `#318` or a link in the search box and open the issue, even when it is not assigned to you. It appears under **Not in your inbox** with its full details beside it. An unknown prefix is tried on Linear and Jira at once.

### Starred issues

Star an issue to keep it on top of the Inbox and of **Pick up a task**. In the search result above, the **Starred** group holds the GitHub issue #211.

### Launch a session from any item

Press **Launch session** on an issue, a Slack thread or an error to start a session with the brief already drafted. A Sentry error or a GitHub or GitLab item opens in its project, and the popover says why.

### Link an item to a session

Attach an inbox item to work that already exists. **Link to a session** sits next to **Launch session** and links the task to the session you pick. From a session it works the other way round: **Link work** in the Overview header, or **L**, opens one search across every connected tracker, with your recent inbox items on top. Filter by source, type an issue code, or paste a link.

### Trackers

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-sentry-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-sentry-light.webp" alt="The Inbox filtered to Sentry, 4 errors from payments-api and notify-relay, with DuplicateChargeError: charge already captured for order open on the right, showing status Unresolved, culprit settle_batch, 42 events, 9 users and a 2 frame stack trace">
</picture>

Read Sentry errors with stack trace, breadcrumbs and tags inside Goodboy, and filter them by project. Comment, assign, edit and move issues in Linear and Jira the same way.

### Code hosts

Work on GitHub pull requests and issues, GitLab merge requests, and Bitbucket comments, approvals and merges without leaving Goodboy. GitHub and GitLab can work side by side, one for code and one for tickets.

### Slack: what agents can do

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-slack-permissions-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-slack-permissions-light.webp" alt="Settings, Integrations, Slack for Harborline: the channels #payments-oncall and #ledger-dev picked, and under What agents can do, Read threads in followed channels Allowed, Read other channels you are in Off, Reply in threads Ask me first, Add reactions Allowed">
</picture>

Decide how far agents go in Slack. Tick the channels they follow, then set each action: **Read threads in followed channels** and **Read other channels you're in** are **Allowed** or **Off**, **Reply in threads** and **Add reactions** are **Allowed**, **Ask me first** or **Never**. Replies default to **Ask me first**, and agents never start new conversations or send direct messages.

### Reply ready for #channel

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-slack-reply-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-slack-reply-light.webp" alt="A session transcript with a card titled Reply ready for #payments-oncall, waiting for you, quoting Omar T. and holding a drafted answer about payments-api #318 and notify-relay #57, with the buttons Send, Edit and Discard">
</picture>

Approve what goes out in Slack from where you already are. Under **Ask me first**, the agent's reply waits in the session as a card with the message it answers and the draft, and you choose **Send**, **Edit** or **Discard**.

### Slack signature

Let people in a thread see when an agent wrote a reply. Under **Signature** in the Slack settings above, the note under agent messages is "Written with Goodboy" by default, and you can change the text or switch it off. A second switch adds it to messages you send from Goodboy.

### Images from your tools

See screenshots attached in Linear, Jira and GitHub inside Goodboy. Your key goes only to that tool's own image host.

### Records read the same way

Read items from any tool the same way: one list of labels and values, with who opened them and when.

### Comment threads

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-comment-threads-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-comment-threads-light.webp" alt="Three conversation panels: a GitLab merge request conversation with Robin V. and a threaded reply from Sam K., a Show 2 earlier replies fold and a Resolved thread row, a GitHub issue conversation quoting leo-t in the Write a comment box, and a read only conversation">
</picture>

Follow replies under the comment they answer, in Linear and GitLab, and fold long threads behind **Show earlier replies**. Press **Reply** on a comment to answer inside its thread, or start a new one in the box below. Where a tool has no threads, the box shows **Quoting** and the name of the comment you answer.

## Plans, reports and wireframes

Plans, reports and wireframes live next to the task, not inside a chat.

### Artifacts

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-list-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-list-light.webp" width="694" alt="The Artifacts list of the Harborline session, 8 items under the tabs All, Plans, Reports and Wireframes: a wireframe at 1 of 2 scouts done, Deliveries screen with 4 screens, a plan marked Ready to run, two reports and two plans marked Ran, each with its kind on the right">
</picture>

Keep plans, reports and wireframes next to the task, each row with its kind on the right (**Wireframe**, **Plan** or **Report**). The tabs **All**, **Plans**, **Reports** and **Wireframes** filter the list. A row shows its state at a glance: **1 of 2 scouts done**, **Ready to run** or **Ran**.

### Plan parts and Run plan

Check a plan before it runs. A plan can give each part done-when checks and the files it expects to touch, and **Run plan** turns each part into a sub-agent.

### Report as a document

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-report-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-report-light.webp" alt="The report Retried webhooks no longer double credit, rev 2, with an Outline (What was wrong, What changed, Evidence, Sources, Open questions, Next steps), the section What was wrong and the What changed table">
</picture>

Read a report as one document. The **Outline** on the left jumps to each section, and **Edit** changes the text in place. The same file opens in a browser on another machine.

### Files on disk

Open any artifact as a folder, in your browser or your file manager. The folder is rewritten on each revision and follows renames.

### Create a wireframe

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-create-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-create-light.webp" alt="The Create wireframe form with a Brief, Attachments, Fidelity set to Repository styled wireframe, Target set to Phone and desktop, Read from payments-api and notify-relay, Based on a run and the Included context list">
</picture>

Describe the screen in a **Brief**, add **Attachments**, and choose the **Fidelity** (**Plain wireframe** or **Repository styled wireframe**) and the **Target** (**Phone**, **Desktop** or **Phone and desktop**). **Read from** picks the project branches the agent looks at, and **Included context** lists exactly what goes in the pack.

### Wireframes scouted first

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-scouts-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-scouts-light.webp" alt="The wireframe Deliveries screen, high fidelity in the Generating state, with Agents on this run: screens and routes done in 14s with 8 of 11 claims verified, and data and contracts still running">
</picture>

Get wireframes that start from your code. Before drawing, two scouts read the repo, one for **screens and routes** and one for **data and contracts**. Each claim they make has to cite a file that exists, and the run shows how many were verified. **Stop** ends the run.

### Wireframe versions

Go back to any wireframe version with **View**, **Compare** and **Restore**.

### Compare

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-compare-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-compare-light.webp" alt="Compare v2 to v3 of the Deliveries wireframe: the screens Deliveries (Changed), Delivery detail (Same) and Endpoints (Same), the two frames side by side, and Changes on this screen with Added Stuck delivery: evt_4Q2x for 14 min and Changed Deliveries table">
</picture>

See what changed between two wireframe versions side by side. Pick the versions at the top, pick a screen on the left, and read the change list underneath. The added banner and the changed table are outlined in the right frame.

### Ask for a change

Point at what you want changed: pick elements on the wireframe, choose this screen or all screens, and ask.

### Import wireframe JSON

Bring in a wireframe made elsewhere, with a preview of any fixes before it lands.

### Revisions and Restore

Bring back an earlier plan, report or wireframe as a new revision, with its author, without losing the later ones.

### Save a copy and New variant

Export a wireframe as a folder of pages, or redraw it at the other fidelity.

## Shared context

What one agent learns, the next one reads. The goal, decisions and a running summary travel with the session.

### Decisions

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-decisions-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-decisions-light.webp" alt="The Context drawer on Decisions with two Active decisions, 3 Dedupe on the event id inside the transaction (replaces 1) and 2 Keep the processor event id on every credit row, plus Replaced and removed 1 and Add a decision, next to the brief sent to Implement 3.1 that says Why: D3 moved the dedupe inside the transaction">
</picture>

Record a decision once and have the agents after it read it. Each one gets a number and a byline, and replacing or withdrawing it needs a reason that stays next to it. Here decision 3 replaces decision 1, so the brief the implementer received carries the new one and says why. Click a decision to open it, with **Edit** and **Remove** inside. A removed decision is retired at once and stays in the list with **Undo** while the drawer is open, and closed decisions are split into **Removed by you** and **Replaced**.

### See why each decision was made

Read the reason behind a decision without opening the run. When Goodboy records a decision from a session, it keeps the reason that came with it, and the context drawer shows it as a muted line under the decision, with **Show more** when it runs long.

### Running summary

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-summary-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-summary-light.webp" alt="The Context drawer on Summary with the blocks State 4, Next 3, Open questions 1 and Learned 2, each with its key line first and Show more links for the rest">
</picture>

Hand the next agent where things stand. After each turn a summary is updated with **State**, **Next**, **Open questions** and **Learned**, and an edit you made in the meantime is kept. Each block shows its key line first and folds the rest behind **Show 3 more**.

### Context drawer

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-drawer-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-drawer-light.webp" alt="The Context drawer of the session Stop retried webhooks posting a second credit on Decisions 5, with Changed since you last looked (4 rows: Added, Replaced by 7, Withdrawn, Reworded) above the Active list">
</picture>

Open goal, decisions and summary from any session page with the **Context** button, and use the copy icon at the top for **Copy as brief**. A dot on **Decisions** says something changed since you last looked, and **Changed since you last looked** lists added, removed and reworded decisions first. Active decisions show their reason under the text when they have one.

### Context budgets

Keep prompts small as a session grows. Each part of the shared brief has its own size, and when decisions run over, the newest are kept.

### Plans handed to the next agent

Hand a plan straight to the implementer. The plan goes from **Ready to run** to **Ran** and shows which agent used it.

## Providers, limits and cost

Watch how much of each plan is left, keep work moving when a provider runs out, and see what it all costs.

### Usage limits chip

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-limits-chip-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-limits-chip-light.webp" width="480" alt="The top bar with the Claude limits chip hovered: a card reading Claude max, Claude is about to run out, Weekly 84% used with its reset time, and Updated 2m ago. Next to the chip are the Codex chip, +1 for more providers and $9.62 today">
</picture>

See how much of your Claude and Codex plans is left before a run stops. Each provider gets a chip in the top bar that draws the 5-hour window and the week as two bars: amber from 80%, red and full at 100%, faded when the figures are old. Hover a chip, as in the picture, to read the plan, how much of each window is used and when it comes back. Checking Claude spends no model tokens: Goodboy runs Claude's own `/usage` in an empty folder.

### Use reset

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-codex-reset-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-codex-reset-light.webp" alt="The Codex provider page, Usage group: 5-hour window 41% used, Weekly 58% used, a row reading 1 free reset with the Use reset button, and Spent in Goodboy with Today $1.94, 7 days $18.40 and This month $61.20">
</picture>

Spend a free Codex reset at the right moment. When Codex offers one, the Usage group of its page shows it with its expiry and **Use reset**, above what you spent in Goodboy today, over 7 days and this month. Goodboy asks you to confirm in place, and when spending it now would waste most of the week it stops you first, with **Keep my reset** as the default.

### Fallback when a limit is hit

Keep a task moving when a provider runs out. With another eligible provider connected, the turn can move there, and the chat records where it went.

### Fallback order and Auto

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-fallback-auto-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-fallback-auto-light.webp" alt="Settings, Providers and models, Defaults: Default provider set to Claude with the note Auto starts here, Fallback order with Claude first, and the Explore and plan roles Scout, Debugger and Planner, each with an Auto picker">
</picture>

Choose where **Auto** starts and how it falls back. **Default provider** says where Auto starts, and **Fallback order** lists the providers it moves through when one is not connected or is out of quota. Each role below, from Scout to Planner, has its own picker, set to **Auto** or pinned to a model.

### Model picker

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-model-picker-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-model-picker-light.webp" alt="The model picker opened on the Implementer role in Defaults: Auto with what it resolves to now, Claude Sonnet 5 Medium, then Provider icons, Model chips Haiku, Sonnet, Opus and Fable, Version 4.6 and 5, and Effort from Low to Max">
</picture>

Pick a model with the reason next to it. The picker leads with **Auto** and what it resolves to right now, then the provider, the model family, the version and the effort. The settings icon beside **Provider** opens **Models in the picker**, where you choose which models appear. When you create an agent, the picker also offers a **Suggested** model with the reason and **Last used here**.

### Impact

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-impact-overview-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-impact-overview-light.webp" alt="Impact, Overview, over 30 days: In the last 30 days Goodboy ran 24 sessions in Harborline, merged 17 pull requests and spent $250.77, then the tiles Pull requests merged 17, Reviews resolved 46, Run by workflows 63% and Median session 1.4h, and the sessions that shipped the most">
</picture>

See what Goodboy got done and what it cost over **7 days**, **30 days** or **All time**. **Overview** opens on one sentence built from your numbers, then tiles for **Pull requests merged**, **Reviews resolved**, **Run by workflows** and **Median session**, each against the period before, and the sessions that shipped the most. **Shipped**, **Flow** and **Spend** go deeper.

### Monthly cap and budget alert

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-monthly-cap-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-monthly-cap-light.webp" alt="Impact, Spend, Claude: 89% of cap with Spent $151.72, Cap $170.00 and Remaining $18.28, and the Monthly cap form with a $170 cap, an alert at 80% of the cap, and the note that Goodboy warns you and routes the next turn to another provider">
</picture>

Set a monthly cap per provider and hear about it before you reach it. In **Spend**, open a provider, enter the cap and the share of it where Goodboy warns you. Claude here has used $151.72 of a $170.00 cap, past its 80% alert. Past the threshold Goodboy routes the next turn to another provider with room, and if none has room, work continues where it is.

## Storage

Free disk space and clean up branches, with what is safe to remove spelled out.

### Worktree folders

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-worktrees-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-worktrees-light.webp" alt="Storage, Worktrees 5.0 GB, with the tabs To review 3, In use 0 and Kept 0: hl/flaky-retry-test 2.5 GB and hl/retire-export-cron 1.8 GB in ledger-core, hl/receipt-email-retry 700 MB in notify-relay, each marked Safe to remove, and the button Remove 3 safe folders in Harborline, 5.0 GB">
</picture>

Free disk space without guessing. **Worktrees** lists the checkout folders of archived, deleted or gone sessions by repo, with their size, when each last changed, why it exists and whether it is safe to remove. **Remove 3 safe folders in Harborline** clears them together, and it takes only clean folders idle for over 30 days. Folders with changes, running agents or a git operation in progress are skipped, with the reason.

### Branches

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-branches-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-branches-light.webp" alt="Clean up branches: 9 local branches with the tabs Safe to delete 7, Needs a look 2 and All 9, grouped by repo under ledger-core, notify-relay and payments-api, each with its session, On origin or Gone on origin, and Safe to delete merged by merge commit, rebase or pull request, plus the button Select 7 safe to delete">
</picture>

Delete old branches with confidence. Local branches are sorted into **Safe to delete** and **Needs a look**, each with its session, whether it still exists on origin and how it was merged: merge commit, rebase or pull request. **Select 7 safe to delete** picks them together, and every deletion can be restored for 14 days.

### Storage scope

Clean up this workspace, other workspaces, removed ones or all of them, each with its weight, from the picker in the page header. Bulk actions name the scope they act on. The page reads as two groups: **Free up space** and **Clean up branches**.

### Free space chip

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-free-space-chip-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/storage-free-space-chip-light.webp" width="680" alt="The top bar with the Free 4 GB chip hovered: Goodboy can free 4.1 GB of worktree folders nobody uses. Open storage. Beside it are 2 need you, 2 running and $9.62 today">
</picture>

See reclaimable space at a glance. While at least 1 GB of worktree folders can go, the top bar shows **Free 4 GB**. Hover it for the exact size, 4.1 GB here, and click to open Storage across all workspaces.

### Artifacts from deleted sessions

Decide what to keep from sessions you deleted: their plans, reports and wireframes, with **Keep** or **Delete**.

### Goodboy can free N GB

Hear about reclaimable space once, when idle safe folders pass 10 GB or the disk runs low. After a notice it waits 14 days and another 10 GB before speaking again.

## Security, backup and updates

Keep tokens out of what you save, move your setup between machines, and update without losing data.

### Security findings

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-findings-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-findings-light.webp" alt="Security findings: 1 saved script looks like it contains a token, seed-sandbox in payments-api, Token ending 9f2c, with Details and the Not a secret button">
</picture>

Catch a token pasted into a saved script before it travels. Each time you save a project script, Goodboy checks it for keys and tokens on your Mac, and findings show in **Settings**, **App**, **Security findings**, as in the picture. **Not a secret** dismisses one and **Flag again** brings it back. The page suggests keeping the value in your shell or a `.env` file that git ignores, and using its name instead, like `$DEPLOY_TOKEN`.

### Findings kept out of the export

Move your setup to a new machine without carrying a flagged token: an export leaves out the script that holds it, unless you include it on purpose.

### Export and import your setup

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-export-import-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-export-import-light.webp" alt="Settings, App, Backup, Export: checkboxes for Workspaces, Projects, Folder paths (off), Your profile, Workflows you made, Workflows the orchestrator wrote (off), Saved scripts, Permission rules, Budget rules, Linked integrations and App preferences, and a Never included box listing API keys and tokens, sign-ins, sessions, artifacts, worktree folders, usage history and notifications">
</picture>

Move your setup to another Mac, or keep a copy. **Backup** exports in groups: workspaces, projects, your profile, workflows you made, saved scripts, permission rules, budget rules, linked integrations and app preferences. **Folder paths** start off because they contain your username, and **Never included** lists what always stays behind, keys and sign-ins first. **Import** shows what it adds before writing, adds and updates but never deletes, and imported integrations ask you to sign in again.

### Backup before a data update

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-backup-notice-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-backup-notice-light.webp" alt="The changelog entry for Goodboy 0.13.0, In the update, 3 features and 1 fix, with the notice: This version updates your data in one direction. To go back to 0.12, restore the backup Goodboy made before updating">
</picture>

Update without worrying about your data. Before an update changes it, Goodboy makes a full copy and keeps the last two, and if the copy fails, the update does not start. A release that changes your data in one direction says so in its changelog entry, as in the picture, and points you to that backup to go back.

### Newer data guard

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-newer-data-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-newer-data-light.webp" width="680" alt="The screen an older Goodboy shows on newer data: This database was upgraded by a newer Goodboy, with the buttons Restore backup and Quit">
</picture>

Open an older Goodboy on newer data without damage. It stops before touching anything and offers **Restore backup** or **Quit**, and your current data stays in a copy next to the database.

### Updates

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-updates-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-updates-light.webp" width="500" alt="The 0.13.1 available pill in the top bar with its confirm open: Goodboy 0.13.1 is available, Nothing is running, and the buttons What's new, Not now and Download and restart">
</picture>

Get updates in the background, then see what is new. A pill in the top bar, **0.13.1 available** here, opens a confirm with **Download and restart**, **Not now** and **What's new**, and it says whether agents are running. With agents running, **Restart when they finish** waits for them.

### Changelog in the app

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-changelog-update-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-changelog-update-light.webp" alt="The Changelog opened from the update, Installed 0.12.3: a search box, releases 0.13.1 and 0.13.0 marked in the update, 0.12.3 marked installed, and Goodboy 0.13.1 with two fixes linked to Sessions and App">
</picture>

Read release notes inside the app, searchable, with links into the screen each change touched, like **Sessions** and **App** beside each fix. Before an update, "What's new" shows every release it brings, marked **in the update**, and the installed one is marked **installed**. After an update, "What's new since" covers the releases you skipped. In the list, only releases that update your data in one direction carry a mark.

### Before and after pictures

See a change instead of reading about it. Release notes can show **Before** and **After** pictures, with a lightbox, in light and dark.

### Guide

Learn how Goodboy works in 18 short chapters that follow a task, with search and links that open each screen. Open **Guide** from the palette.

## Agents

Talk to agents, watch what they do and steer them while they work.

### Workspace chat

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-workspace-chat-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-workspace-chat-light.webp" alt="Chat in Harborline: the chat list grouped by Pinned, Today, This week and Idle with Archive idle, and the answer to Where is the consent step defined? as a table of three payments-api files, with Read 4 files, Copy and Start work from here, under the chips Harborline · 3 projects, Read-only and Sonnet 5">
</picture>

Ask about the workspace without starting a session. **Chat**, next to **Board**, opens your chats on the left and one conversation on the right. Each chat reads every project of the workspace (**Harborline · 3 projects**) and never changes a file (**Read-only**): the answer streams in, **Read 4 files** lists what it opened, and the model, here **Sonnet 5**, is picked per chat from Claude or Codex, the two providers that can be held to reading. Chats you have not used for seven days move to **Idle**, dimmed, and **Archive idle** clears them with an **Undo**. Nothing is archived for you.

**Start work** turns a chat into work in a panel beside it: the chat's model drafts a title, a goal, what the chat established and the files it named, you edit any of it, then start a new session with that goal or send it into a session that is already running. The **Project** field searches your projects and takes none, one or several; **Add to a session** lists sessions by Active and Recent, with their projects, stage and age.

The top bar shows when a chat is working: a pulsing dot and "1 chat running" on **Chat**, and a still **New reply** dot in the notification color on it, and on the chat in the list, until you open the chat.

### Roles

Give each agent the job it is good at. Nine roles come with the app, **Scout**, **Debug**, **Plan**, **Implement**, **Review**, **Test**, **Resolve**, **Docs** and **Generalist**, and a role sets the agent's instructions, its default model and what it hands back.

### What the agent received

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-what-received-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-what-received-light.webp" alt="The top of the Credit once per event id chat: an Also received row with the chips Goal, Plan, 2 files and All, above the message sent by Codex about payments-api and notify-relay, then an Operations row with 1 Grep and 1 Read">
</picture>

Check exactly what an agent was told. The top of each chat shows the message it got and who sent it, here **Codex**, with an **Also received** row that has a chip for each part of its brief: **Goal**, **Plan**, **2 files**. **All** opens the whole brief, and **View as sent to** the provider shows the exact text, with a copy button.

### Agent transcript

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-transcript-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-transcript-light.webp" alt="An agent transcript: the ask about the retried webhooks and payments-api#318, the agent's answer, chips for the plan Dedupe on the event id, the report Where the second credit comes from and the wireframe Deliveries screen, retry state, and a Resolve findings group with thread 1 explained, thread 2 closed with commit 9f2c1ab and thread 3 no change">
</picture>

Follow one agent's work in order. The plan, report and wireframe it writes show as chips under its text, and a **Resolve findings** group lists each review thread as **explained**, **closed** or **no change**. File edits group into **Operations** rows, and questions and permission cards appear in the flow where you answer them.

### Queue or send now

Keep talking while an agent works. **Enter** queues your message for its next turn, **⌘Enter** interrupts and sends it now, and the queue survives a restart.

### Stop and Continue

Stop an agent without losing its work. Stopping keeps what it wrote and offers **Continue**. An agent that was working when you reload, restart or update Goodboy keeps going: a reload finds it still running, and after a restart it picks up where it stopped, with a note in its chat. One that cannot pick up says **Stopped by restart** and offers **Resume**.

### Turn footer

See what each turn cost: provider, model, duration, tokens, cache share, estimated cost and a context meter.

### Tool call states

Tell at a glance what a tool call did: **Running**, **Done**, **Failed**, **Needs approval**, **Stopped** or **Denied**, with elapsed time and readable input and output.

### Composer plus menu

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-composer-menu-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-composer-menu-light.webp" alt="The message box of a chat with the plus menu open, listing Attach files, Run a script ($), Start a workflow (~) and Ask another agent (@), next to Ask first and the GPT-5.6 Sol model">
</picture>

Do more from the message box. The **+** opens **Attach files**, **Run a script** (`$`), **Start a workflow** (`~`) and **Ask another agent** (`@`). `$` lists your saved scripts and your `package.json` scripts, across pnpm and yarn workspaces.

### Attach files

Hand an agent images, PDFs, CSV and text files, up to 10 at a time, by paste, drop or pick.

### Drift warning

Hear about it when an agent steps outside its role, like a planner editing files. Goodboy checks each turn against the role and sends a notification.

### Subagents from plan parts

Run a plan part by part. An implementer given a plan splits into one sub-agent per part, shown as 3.1 and 3.2, and a plan can give each part done-when checks and the files it expects to touch.

### History rewriter and Scribe

Let two helpers work on your history and your pull request text without the power to push. Their git points at a push address that goes nowhere, and their GitHub tokens are removed.

### One language per session

Get agents and summaries in the language of your goal.

## Support Goodboy

The best support is running Goodboy on the work you already have. When something feels off, or you have an idea, report it from inside the app in one line.

### Report a bug

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/support-report-bug-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/support-report-bug-light.webp" alt="The Report a bug sheet with the type Bug, an empty line reading What went wrong, in one line, the chips 0.13.0 · 3f9c2ab, macOS 15.5 arm64, Board and Claude CLI 2.1.260, Codex CLI 0.58.0, the What gets sent row, Public issue on GitHub, under your account, Add detail and Send" width="670">
</picture>

Tell us what broke in one line. **⌘I** (**Ctrl+Shift+I** on Windows and Linux) opens the **Report a bug** sheet from any screen, and so do the footer chip, the palette, Settings, the macOS Help menu and **Report this** on a notification. Version, system, screen and CLI versions come along as chips you can remove, **What gets sent** shows exactly what leaves, and secrets, paths and emails are stripped. It files through gh, or opens the issue on GitHub. After a crash, the next launch offers to report it.

<a id="keyboard-and-terminal"></a>
<details>
<summary><h2>Keyboard and terminal</h2></summary>

### Terminal

Open a real login shell in the session's worktree. **⌘⌥T** opens the Terminal view, **⌘T** adds a tab, and the shell is still there after a reload. **⌘F** finds in its scrollback.

### Keyboard shortcuts, back and forward

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-shortcuts-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-shortcuts-light.webp" alt="The Shortcuts page, 57 shortcuts, in the groups General, Workspaces, Navigate and Views, with Command palette on ⌘K, Report a bug on ⌘I, Back on ⌘[ and Forward on ⌘], and a ⌘⌥ key for each view from Overview to Slack threads">
</picture>

Drive Goodboy from the keyboard: 57 shortcuts, a **⌘⌥** key for each view, workspaces 1 to 9 on **⌘1** to **⌘9**, and **⌘[** and **⌘]** through history. **⌘/** opens the list. One registry drives the keys, this page and the tooltips. **Esc** closes what is open inside the app and never takes the window out of macOS full screen.

### Script drawer

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-script-drawer-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-script-drawer-light.webp" alt="The Scripts page with the Check posting drift drawer open on the right: Failed after 12s in ledger-core on nw/fix-settlement-replay, a Command line, the failing vitest output, Run again, Exit 1 and Copy output">
</picture>

Watch a script's live output in a drawer beside the list. **Stop** ends a running script, **Run again** starts it over, the footer shows the exit code and the time (**Exit 1 · 12s**) with **Copy output**, and the drawer comes back after a reload.

### Open in editor

Jump into VS Code, Cursor, Zed, the JetBrains IDEs, Sublime Text, Vim or Neovim, at the worktree or the file. VS Code and Cursor open it in the window you already have.

### Explore

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-explore-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/keyboard-explore-light.webp" alt="Explore in Harborline: the session folder as a file tree with the notes and exports folders and brief.md, settlement-batches.csv and drift-summary.xlsx, and the northwind-call.md preview on the right with its path, size, Open outside and Copy">
</picture>

Browse the session folder as a file tree, with a preview of the selected file beside it, **Open outside** and **Copy**. **Ask an agent about this file** starts an agent on it from the row.

</details>

## Also there

| Feature            | What it does for you                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Written by Goodboy | Comments Goodboy posts end with a line that says so, and a setting turns it off          |
| Resolve again      | Rereads a comment and tries the fix once more                                            |
| Checks             | The pull request's checks with durations, and a failed one becomes a **Next** suggestion |
| Settings rail      | Each settings area says what needs you, like folders not found                           |
| Update pill        | A single light sweep when an update is ready                                             |
