# Workspace and projects

Keep your repos together, and let sessions work across them.

### Start a project from nothing

Begin with an empty folder and no repository. **Start a new project** on the empty screen, in the workspace launcher and in the setup wizard makes the folder, starts a git repository on main with a first commit that holds only a .gitignore, and opens a first session that works in that folder. **Publish** creates a repository on your GitHub account, private or public, or links one you already have. When main is on the remote, **Move my work** puts what you have not committed into a session named bootstrap with its own worktree, and the folder is clean again.

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

### Copy settings from another workspace

Workspace settings has one page per area: Projects, About you, New sessions, After merge, Review replies, Permissions, Skills and Disconnect. New sessions names the branches: the **Branch prefix** takes letters, numbers, `-` and `/`, and **Branch name** offers the name without a task id, the name with the task id first (the default), or **Custom**, a template with `{prefix}`, `{task-id}`, `{slug}` and `{user}`. Each choice is labelled with the name it gives your last session, and a template git would refuse says why before it is saved. Existing branches keep their names. A dot after a label means the value is not the default; its menu has **Reset**. From the menu of a page, **Restore defaults** puts that page back, and **Copy from…** takes the values of another workspace. **Copy settings from…** on the Settings home does the same for every page at once. You see what changes, page by page, before anything is saved, and **Undo** puts it back. Projects, folders, accounts and permission history are never copied.
