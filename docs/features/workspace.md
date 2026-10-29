# Workspaces and folders

A workspace keeps your folders together, and one session can work across several of them. Each branch an agent works on gets its own worktree, so agents edit in parallel without touching your checkout.

### Start from scratch

Begin with an empty folder and no repository. **Start from scratch**, inside **New workspace**, makes the folder, starts a git repository with a first commit and opens a first session in it. **Publish** later creates a GitHub repository for it, or links one you already have.

### Track a folder with git later

Start in a plain code folder and add git when you want it. When you pick a folder, Goodboy asks whether it is a **Code project** or **Documents**, preselected from what it holds, and you can change it later in **Settings › Folders**. A code folder can be tracked with git right at Create. **Track with git** in **Settings › Folders** shows the first commit before it happens: what goes in, dependency and build folders left out until you tick them back in, and files that look like secrets, which always stay out and go to `.gitignore`. Nothing leaves your Mac until **Publish to GitHub**. A repository with no commit yet holds sessions back, because a session branches from the latest commit: the empty board says so and its one action, **Make the first commit**, opens the same review in place and reads the repository again once it is made. A plain folder with an empty repository is still edited in place until its first commit. Git you set up outside the app is noticed when the window comes back: a code folder moves to branches between turns and offers **Keep editing in place**, and a documents folder asks first.

A plain folder is edited in place by one session at a time, and the next one waits its turn; reading is never blocked. **Plain folders** in **Settings › Folders** lists each one with its face, the saved versions it uses and a switch between Code project and Documents. Office files and PDFs are read, never rewritten, in a documents folder. What each turn changed is under **Changes** in the session rail, and it stays there when you later track the folder with git. Unlinking a folder waits while an agent is writing in it.

### Workspace with several folders

Keep your repos together as one workspace, and let one session work across several of them. The **Projects** card of a session lists each repo it touches, with its branch and the size of its changes. A folder gets a branch only when an agent needs to edit it. The **+** on the card adds another workspace folder, or connects a new repo or folder to the workspace from the same list.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-several-projects-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-several-projects-light.webp" alt="The Harborline workspace with one session open: its Projects card lists ledger-core with four branches and notify-relay with two, each branch with its pull request icon, above the Linked issues, next to the Next row with Start and the Activity tabs">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Starred folders, descriptions and base branch

Point agents at the right repo without naming it. Star a folder and give it a one-line description: both go into each agent's brief, and starred folders come first in the pickers. Each repo shows its base branch, read from origin.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-starred-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-starred-light.webp" alt="The Harborline workspace settings, Folders: Starred 2 with ledger-core and payments-api, each with a one-line description and the base branch main, Other folders 2 with notify-relay and runbooks, the Git repository section with Convert, and a note about a session folder left on disk with Review in Storage">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Worktrees

Let agents edit in parallel without touching your checkout. Each branch gets its own worktree, a separate folder with its own changes and pull request, named gb- and six characters such as gb-7k2q9x, with the session and the branch shown next to it. **New branch**, the **+** at the end of a repo's row in the session sidebar, adds one, **Close branch** clears a merged one, and **Reopen** brings back one whose files were kept.

The Projects card is one tree for every branch of the session. A branch is one line: its pull request state as a colored glyph, its pull request title (or the branch name when there is none) and, only when something needs you, one chip: failing checks, a conflict or how far it is behind. Live branches come first, queued, approved, open, draft, then those with no pull request; merged and closed ones fold into one **finished** line. Click a branch to open it: its pages (pull request, comments, files, commits, checks) open under its row, with its **Rebase** line when it is behind, and a click on the open row folds them again. The branch menu, from the dots on the row, a right click or Shift+F10, holds Rebase, Switch branch, Link work to this branch, Copy branch name, Close branch and the rest.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-worktrees-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-worktrees-light.webp" alt="A session with its Projects card: ledger-core with three branches (fix/le...postings with pull request #418, fix/ledger-...backfill with no pull request and fix/ledge...drift with #412) and notify-relay with fix/noti...backoff #96, and above the card the notice that fix/ledger-reconciliation-statement-backfill in ledger-core is closed and its files are still on disk, with a Reopen button">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Several branches per repo

Work on several branches of one repo in the same session, each in its own worktree. If a worktree ends up on another branch, a card says so and offers **Use this branch here** or **Keep both branches**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-branches-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-branches-light.webp" alt="The Projects card of one session where two branches are not the ones recorded: ledger-core is on another branch and offers Check again and Not now, and notify-relay offers Use this branch here, Keep both branches and Not now">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Workspace switcher and Reconnect

Jump between workspaces and folders from one search. The current workspace sits on top with its folder count, **Add folder** (the folder picker, a repository or a plain folder, then an undo toast; a folder of another workspace points to its folders; **Move it here** into the open workspace, or a merge, adds the moved sessions without stopping any running agent, and it is refused with the number of agents running in the source until you stop them), **Manage folders** and its settings. The other workspaces follow in one list: a click switches once the new workspace has loaded, so a quick second click wins and a failed load keeps the workspace you were in, the window icon opens one in a new window, and a disconnected workspace keeps its place with **Reconnect**. **New workspace** closes the list and opens the one form. Disconnecting a workspace keeps its history, and adding its folder again offers **Reconnect** too.

A workspace you are not looking at can still need you. Its row in the list says **2 need you** in amber, or red when one of them is broken, with the reasons in place of the folder line, for a workspace open in another window as well as for one that is open nowhere. The same sessions are added up as a number on the workspace name in the top bar when any other workspace needs you, and the bell can widen to **All workspaces**. The count of a workspace nobody shows is read from the database every 30 seconds and counts what is saved there: an open question, a fix run waiting for your answer, a failed push, failing checks and an errored session. The window that shows a workspace also knows what lives only in memory, such as a plan or a permission waiting, so it sends its own count to the other windows and that count wins while the window is open.

### New worktrees start usable

A new worktree is a clean checkout, so the folder settings carry what it lacks. **Worktree setup**, under a repository folder in Settings, lists its git-ignored files (`.env.local`, `config/local.json`), none ticked, a secret marked **secret: only when ticked**; the ticked ones are copied into every new worktree, only when git ignores them and never over a file that is already there. **Setup after creation** is prefilled from the lockfile (`pnpm install`) and says where it came from. When a session cuts a worktree, the overview shows **Worktree payments-api/retry-webhook is ready**, what was copied and the proposed setup with **Run** and **Not now**; the setup never runs without that click. Dependencies are never copied byte by byte: that is what the setup is for.

### Repo status across folders

See which repos have something to pull, right next to the workspace switcher.

Every 5 minutes Goodboy fetches origin for each repo. It compares the local base branch (the folder's base branch, else the remote default branch) with its upstream. Fetching never moves a local branch.

- A repo that is behind puts a dot and **3 behind** on the **Repositories** entry.
- A repo whose base branch has commits of its own reads **Diverged**. Its tooltip explains that Goodboy only fast-forwards, so you merge or rebase it yourself.
- When origin cannot be reached, the entry reads **Check failed**, with **Retry** on the row, and no toast.

The entry opens one header row: the title, when origin was last checked, **Pull all** once two or more repos can pull, and the refresh icon. Under it come the repos that need attention.

- A behind repo has **Pull**.
- A diverged repo has the reason in words.
- A failed check has **Retry**.
- The repos with nothing to pull fold into one quiet line, **18 up to date**. It opens on click.
- Every row shows its folder in Finder and opens it in the editor in one click. It keeps the action column put when it has no **Pull**, and opens its detail in place under the row.

A pull leaves some branches alone.

- A checkout on a feature branch stays there while its base branch moves.
- A base branch checked out with uncommitted files says so instead of offering **Pull**.
- A base branch that would not fast-forward, or is checked out in another worktree, is skipped.

**Settings › General › Repositories** sets how often it checks (Off, 5, 15 or 30 minutes). Several windows on one workspace share one fetch.

⌘K **Pull main in all linked repos** and **Pull <branch> in <repo>** run the same pull. A toast lists each repo with its branch, and the title counts updated, skipped and failed.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-repo-status-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-repo-status-light.webp" width="740" alt="The Repositories popover opened from the top bar entry 2 repos behind, Diverged: Checked 4m ago with Pull all, payments-api 3 behind and ledger-core 1 behind each with Pull, notify-relay Diverged with the reason in words, risk-models Couldn't reach origin with Retry, and the line 18 up to date">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Locate moved folders

If you moved your repos to a new folder, the workspace settings name the folders Goodboy cannot find. **Locate folders** finds them in the parent folder you pick, by their first commit and remote, and repairs the worktrees, with **Undo move**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-locate-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/workspace-locate-light.webp" alt="The Locate moved folders form: Confirm the folders Goodboy should reconnect, ledger-core moved from its old folder to ~/code/harborline/ledger-core, Same repository, and the buttons Cancel, Choose another folder and Move 1 folder">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Keep .goodboy out of git

Keep Goodboy's own folder out of your commits with one click. The card shows up only when git does not already ignore `.goodboy`.

### Branch names

Choose how new session branches are named: a **Branch prefix**, with or without the task id, or a **Custom** template. Each choice shows the name it would give your last session, and existing branches keep their names.

### New runs start as

Choose how **Start a run** handles a new ask in this workspace: **Let Auto pick**, **Workflow** or **Auto agent**. With a session open, a second row, **New runs in this session start as**, sets that session's own default, which wins over the workspace one. Either reaches new runs only, and each change shows a toast with **Undo**.

### Auto asks you

Choose how much Auto may do alone in this workspace: **Every step**, **After the plan** (the default) or **Never**. It is separate from the workflow **Asks you** default, so workflows can keep asking at every step while Auto goes on after the plan. Each Auto can change its own level from its page.

### Monitoring

See which ports are taken and by whom. The page has four groups: **Pinned** (ports you pin, with your own description), **Run by Goodboy**, **From workspace** and **Listening on this Mac**. Every group shares one column grid under one sticky header (Port, Label, Opened by, Process, Up, CPU, Memory), a process on many ports is one expandable row, and a group's header carries its count and its free ports (`3 · 2 free`); the free count opens the free ports under the ports in use. Expanded rows sit one step in. A terminal or script with no port says "no port" in faint text and shows its process. A port also open in another worktree shows the warning dot and "+2" after its owner, the worktrees in the tooltip. Leftovers sit on the same grid with their age under Up.

Rows rest quiet. **Stop** and the **⋯** button live in one fixed cell that fills when you rest on a row, tab into it or open its menu, and a right click on any row opens the same menu: Open in browser, Pin or Edit description, Stop, Force stop, Hide or Unpin, Copy address. Stop asks first and names who loses the port; a process that does not exit in time shows **Force stop** in its place, which asks again. A refused stop leaves the row and reports why. With nothing tracked the page says **No ports in use** and offers **Pin a port**. It works on macOS and Linux.

### Copy settings from another workspace

Set up a new workspace by copying another one. **Copy from…** in a settings page menu takes that page's values from another workspace, and **Copy all pages from…** takes them all. You see what changes before anything is saved, and folders and accounts are never copied.

## Under the hood

This part is for contributors and agents who change the feature.

- Attention count of an open workspace: the window that shows it sends its count to the other windows on `goodboy:attention`.
