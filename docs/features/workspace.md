# Workspace and projects

A workspace keeps your repos together, and one session can work across several of them. Each branch an agent works on gets its own worktree, so agents edit in parallel without touching your checkout.

### Start a project from nothing

Begin with an empty folder and no repository. **Start a new project** makes the folder, starts a git repository with a first commit and opens a first session in it. **Publish** later creates a GitHub repository for it, or links one you already have.

### Workspace with several projects

Keep your repos together as one workspace, and let one session work across several of them. The **Projects** section of a session lists each repo it touches, with its branch and the size of its changes. A project gets a branch only when an agent needs to edit it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-several-projects-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-several-projects-light.webp" alt="The Northwind workspace with one session open: its Projects section lists api on the branch feat/create-orders-endpoint and storefront-web on feat/checkout-orders-api, each with New branch and its changes, above the activity timeline">
</picture>

<sub>Screenshot from Goodboy 0.23.0</sub>

### Starred projects, descriptions and base branch

Point agents at the right repo without naming it. Star a project and give it a one-line description: both go into each agent's brief, and starred projects come first in the pickers. Each repo shows its base branch, read from origin.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-starred-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-starred-light.webp" alt="The Harborline workspace settings, Projects: Starred 2 with ledger-core and payments-api and the base branch main, then Other projects 2 with notify-relay and runbooks, a note that starred projects come first for agents, and the Dev project section with Convert">
</picture>

<sub>Screenshot from Goodboy 0.23.0</sub>

### Worktrees

Let agents edit in parallel without touching your checkout. Each branch gets its own worktree, a separate folder with its own changes and pull request. **New branch** adds one, **Close branch** clears a merged one, and **Reopen** brings back one whose files were kept.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-worktrees-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-worktrees-light.webp" alt="The Projects of one session: ledger-core with three branches (idempotent-postings, pull request 418; statement-backfill with Files kept and Reopen; rounding-drift under Completed, pull request 412 merged, with Close branch) and notify-relay with pull request 96, each project with New branch">
</picture>

<sub>Screenshot from Goodboy 0.23.0</sub>

### Several branches per project

Work on several branches of one repo in the same session, each in its own worktree. If a worktree ends up on another branch, a card says so and offers **Use this branch here** or **Keep both branches**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-branches-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-branches-light.webp" alt="The Projects of one session where two branches are not the ones recorded: ledger-core is not on the branch it was left on and offers Check again and Not now, and notify-relay offers Use this branch here, Keep both branches and Not now">
</picture>

<sub>Screenshot from Goodboy 0.23.0</sub>

### Workspace switcher and Reconnect

Jump between workspaces and projects from one search. Disconnecting a workspace keeps its history, and adding its folder again offers **Reconnect**.

### Repo status across projects

See which repos are behind, uncommitted or diverged from the **N repos** popover in the board header. **Update** brings the safe ones up to date together, fast-forward only, and leaves the rest to you.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-repo-status-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-repo-status-light.webp" alt="The 3 repos popover of the board: 1 behind and 1 uncommitted, an Update 1 button, payments-api 2 behind, notify-relay 1 uncommitted and ledger-core up to date" width="746">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Locate moved projects

If you moved your repos to a new folder, the workspace settings name the projects Goodboy cannot find. **Locate folders** finds them in the parent folder you pick, by their first commit and remote, and repairs the worktrees, with **Undo move**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-locate-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-locate-light.webp" alt="The Harborline workspace settings with a warning, 3 projects are not where Goodboy left them, and a Locate folders button, above the project list where each repo reads Folder not found">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Keep .goodboy out of git

Keep Goodboy's own folder out of your commits with one click. The card shows up only when git does not already ignore `.goodboy`.

### Branch names

Choose how new session branches are named: a **Branch prefix**, with or without the task id, or a **Custom** template. Each choice shows the name it would give your last session, and existing branches keep their names.

### Monitoring

See which ports are taken and by whom. **Monitoring** lists the ports your projects use with the session, script or terminal that holds them, the processes Goodboy started, and leftovers from earlier runs, with **Stop** on each. It works on macOS and Linux.

### Copy settings from another workspace

Set up a new workspace by copying another one. **Copy from…** in a settings page menu takes that page's values from another workspace, and **Copy all pages from…** takes them all. You see what changes before anything is saved, and projects, folders and accounts are never copied.
