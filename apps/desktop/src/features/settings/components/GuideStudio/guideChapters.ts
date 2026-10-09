import type { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { GuideLink } from './guideTarget';

export type GuideGroup = 'start' | 'task' | 'reference';

export type GuideExtra = 'stages' | 'shortcuts' | 'listens' | 'legend';

type GuidePoint = {
  readonly term: string;
  readonly desc: string;
};

export type GuideChapter = {
  readonly id: string;
  readonly group: GuideGroup;
  readonly title: string;
  readonly concept: keyof typeof CONCEPT_ICONS;
  readonly lead: string;
  readonly note?: GuidePoint;
  readonly points: ReadonlyArray<GuidePoint>;
  readonly links: ReadonlyArray<GuideLink>;
  readonly extra?: GuideExtra;
};

export const GUIDE_GROUP_LABEL: Readonly<Record<GuideGroup, string>> = {
  start: 'Start here',
  task: 'Life of a task',
  reference: 'Reference',
};

export const GUIDE_CHAPTERS: ReadonlyArray<GuideChapter> = [
  {
    id: 'overview',
    group: 'start',
    title: 'What is Goodboy',
    concept: 'guide',
    lead: 'A desk for running coding agents in parallel. Each task becomes a session on the board, with its own agents, branches and history. The chapters follow the life of a task, from setup to cleanup.',
    note: {
      term: "Goodboy runs each provider's own CLI",
      desc: 'It never talks to providers directly. It runs each CLI as a subprocess and streams its events. Your login, usage and quotas stay inside that CLI. Goodboy adds the workspace, the board and the orchestration on top.',
    },
    points: [],
    links: [],
  },
  {
    id: 'workspace',
    group: 'task',
    title: 'Workspace and projects',
    concept: 'projectRepo',
    lead: 'A workspace keeps the repos you work on together. Each repo is a project, and one session can work across several of them.',
    points: [
      {
        term: 'Projects agents know about',
        desc: 'Star the projects agents should reach for first and give each a one-line description. Both go into every agent brief, and each project shows its base branch.',
      },
      {
        term: 'A project from nothing',
        desc: 'Start a new project from an empty folder. The first session works in that folder, Publish puts main on GitHub, and Move my work then carries what you have not committed into a bootstrap session.',
      },
      {
        term: 'A branch only when needed',
        desc: 'A project gets its own worktree and branch only when an agent needs to edit it, so your own checkout stays as it is. New sessions, in workspace settings, sets the branch name: task id first, without a task id, or Custom with placeholders.',
      },
      {
        term: 'One window per workspace',
        desc: 'Open each workspace in its own window, so switching never interrupts running agents. After a restart, every window reopens where it was.',
      },
      {
        term: 'Moved folders',
        desc: 'Moved your repos? Pick the new parent folder and Goodboy finds them and repairs the worktrees.',
      },
      {
        term: 'About you',
        desc: 'Tell agents once who you are and how you like to work. Settings shows which role reads each part. Topics under Explain more when it touches collect what agents explained about them, in Learned.',
      },
      {
        term: 'Pinned scripts',
        desc: 'Pin a script per project from Scripts in a session or from the Scripts list on Projects. It holds across worktrees and shows under $ in the palette.',
      },
    ],
    links: [
      {
        label: 'Open Projects',
        target: {
          kind: 'studio',
          studio: { kind: 'settings', focus: { scope: 'workspace', section: 'projects' } },
        },
      },
      { label: 'Open a folder', target: { kind: 'studio', studio: { kind: 'addWorkspace' } } },
    ],
  },
  {
    id: 'providers',
    group: 'task',
    title: 'Providers, limits and resets',
    concept: 'providers',
    lead: 'Each provider connects with a login you already have or an API key. Goodboy watches your plan limits so a run does not stop by surprise.',
    points: [
      {
        term: 'One page per provider',
        desc: 'Usage, the models in your picker, permissions and your account, in one place. Providers billed per token say so instead of showing usage windows.',
      },
      {
        term: 'Auto',
        desc: 'Auto runs each role on the newest model of its line, Sonnet 5.5 on Claude today, and Models shows what it picks now. Open a role to see how it runs, and give it up to three models for Auto to pick from. A model you turn off in Models in the picker is left out of Auto and the workflow orchestrator.',
      },
      {
        term: 'When a provider is out',
        desc: 'Models has a row for what happens when a provider is out. It lists the providers of the workspace in order, each On, Backup only or Off. New work starts on the first On provider, Backup only runs only if no On provider can, and Off is never offered. Drag a row, or press Alt and an arrow, to move it. The Limits chips in the top bar open your limits and the same list.',
      },
      {
        term: 'Usage limits',
        desc: 'The top bar shows each provider as its icon and two bars, the 5-hour window and the week. A bar changes color as it fills, and the tooltip gives the percentage and when it resets.',
      },
      {
        term: 'Use reset',
        desc: 'When Codex offers a free reset, the provider page shows it with its expiry, and warns you when spending it now would waste it.',
      },
      {
        term: 'Fallback',
        desc: 'When a provider runs out, the turn can move to another provider the list allows, and the chat records where it went.',
      },
      {
        term: 'Cost',
        desc: 'Impact shows what got done and what it cost, deleted sessions included. A monthly cap per provider warns you before you reach it.',
      },
    ],
    links: [
      {
        label: 'Open Providers',
        target: { kind: 'studio', studio: { kind: 'settings', focus: { scope: 'providers' } } },
      },
      { label: 'Open Impact', target: { kind: 'studio', studio: { kind: 'impact', scope: null } } },
    ],
  },
  {
    id: 'kickoff',
    group: 'task',
    title: 'New session and kickoff',
    concept: 'sessions',
    lead: 'A session is one task: a goal, the agents working on it, and a branch for each project they edit. It starts as a draft and becomes a session only when you press Start or Start blank.',
    points: [
      {
        term: 'Pick up a task',
        desc: 'Choose an issue from your tools or Tasks. Goodboy drafts a short title and goal linked back to it, and you edit them in the same block. Then run it through the same workflow builder, or ask an agent, and press Start from the issue. A Sentry error or a GitHub or GitLab item opens in its project and says why. A GitHub pull request link gives Review pull request.',
      },
      {
        term: 'Run a workflow',
        desc: 'The same workflow builder as in a session: pick Orchestrated, Describe steps or Pick a workflow, see and edit the plan, then Start run creates the session and starts the run.',
      },
      {
        term: 'Ask an agent',
        desc: 'Ask a question about the code. Scout is the default and maps an unfamiliar repo before you plan.',
      },
      {
        term: 'Chat',
        desc: 'Chat, a door in the left column, answers a question about the whole workspace without a session. It only reads, on Claude or Codex, with the model and effort you pick for each chat. Make default in the picker saves them for new chats in the workspace. Start work from chat drafts a brief, and Start session opens a new session with it, nothing running yet, or Add to a session leaves it in the message box of one you pick. Paste, drop or attach up to 10 images to a message, and Claude or Codex reads them. Each chat row shows its model. Pin and archive a chat from its menu, delete it from its row or header, or select several and archive or delete them together.',
      },
      {
        term: 'Start blank',
        desc: 'Start from the goal: the session opens on its Overview, where you add the goal, projects and work when you are ready.',
      },
      {
        term: 'Named for you',
        desc: 'A new session gets a short title, marked Named by Goodboy until you rename it.',
      },
      {
        term: 'When to start fresh',
        desc: 'When the goal shifts or the context is nearly full, a new session is cheaper than steering an old one back on track.',
      },
    ],
    links: [{ label: 'Start a new session', target: { kind: 'newSession' } }],
  },
  {
    id: 'board',
    group: 'task',
    title: 'Board',
    concept: 'workspace',
    lead: 'The home screen. Each session sits in a lane based on what is happening in it, so you never move cards by hand.',
    points: [
      {
        term: 'Session card',
        desc: 'Pull request, issue and project chips, step progress, agent count, age and cost, plus one suggested action.',
      },
      {
        term: 'Done and archived',
        desc: 'Done and archived are lanes of their own, always on the board with every card, after building, running, needs you and in review. Archive keeps everything and can be undone. Delete removes the transcript and files for good, and its cost and merged pull requests still count in Impact.',
      },
      {
        term: 'Select many',
        desc: 'Tick the checkbox that shows when you point at a card, press X on a card, or lasso or modifier-click cards across lanes. The bar at the bottom archives, restores or deletes them together, and Esc clears. Lists with checkboxes elsewhere use the same bar.',
      },
      {
        term: 'Ongoing',
        desc: 'Tasks linked to the whole workspace sit in the Ongoing row. Pick one to show only its sessions.',
      },
      {
        term: 'Now chip',
        desc: 'The top bar counts sessions that need you and running ones, from any screen.',
      },
      {
        term: 'Left column',
        desc: 'New session, Board, Tasks, Chat and Workflows come first, then your sessions, then Settings, the Goodboy row and the bug report button. ⌘B folds it into icons. Legacy layout in Settings, App, General brings back the top bar buttons and the footer.',
      },
      {
        term: 'Session rows',
        desc: 'One line each: a mark and the title. The mark is red only when something broke, amber when you must answer, approve or act, green when the pull request is ready to merge, a teal ring while it waits in the merge queue, and a filled violet check when the session is done. Rest on a row for its card. The Sessions menu sorts, groups, filters by project and shows archived. Control Tab flips between recent sessions, and Option Command Down jumps to the next one that needs you.',
      },
      {
        term: 'Pin a session',
        desc: "Pin session, in a row's right-click menu or the palette, moves a session to a Pinned group at the top of the list, in the order you pinned them, whatever the sort or filter. Unpin session puts it back.",
      },
      {
        term: 'Ask in a session',
        desc: 'Ask, in the page bar or on ⌘L, opens a panel that reads the session: what needs you now, and answers with buttons for what you can do. Nothing runs in one click.',
      },
    ],
    links: [{ label: 'Go to the board', target: { kind: 'board' } }],
    extra: 'stages',
  },
  {
    id: 'agents',
    group: 'task',
    title: 'Agents, roles and workflows',
    concept: 'agents',
    lead: 'An agent is one run of a provider CLI inside a session. A role gives it a job, and a workflow chains agents into steps.',
    points: [
      {
        term: 'Roles',
        desc: 'Scout, Plan, Implement, Debug, Test, Review, Docs, Resolve and Generalist. A role sets the instructions, the default model and what the agent hands back.',
      },
      {
        term: 'Talking to an agent',
        desc: 'Enter queues your message for its next turn, and ⌘Enter interrupts and sends it now. Stop keeps what it wrote and offers Continue. After a restart or an update, agents that were working stay Stopped. Use Resume on one agent, Resume all in overview Next steps, or Resume all above a run.',
      },
      {
        term: 'Activity',
        desc: 'Activity has two views, Activity and Log. Activity shows one row per launch: a run, an agent, or a fix run with its comments. It reads newest first, and a run has a lane in its own colour. Each row starts with its role as an icon and ends with the model that ran (N models on a run past two), the duration and the cost. Rest the pointer on an icon or a model to see its card, or press I on a row. A finished run or step folds into a count row such as 4 subagents; click it or press Right to open it. Needs you sits on top with what waits for you. Log holds the facts, such as links, branches and decisions. The Runs tab lists the runs of a session.',
      },
      {
        term: 'Run page',
        desc: 'A run page reads top to bottom: the header with Pause and Stop run, the steps with sub-agents indented under their agent and finished sets folded into one row, and the composer at the bottom. While the run waits for its plan, Review plan opens it in a drawer.',
      },
      {
        term: 'Agent suggests',
        desc: 'When an agent recommends another role, its transcript shows Agent suggests with the reason. Pick the provider, model and effort, then press Start. The new agent begins with that reason and what the previous agent wrote.',
      },
      {
        term: 'Workflows',
        desc: 'Start from Refactor, Plan and ship or Fix a bug, or build your own. Each step follows its role or pins a model, and its menu holds Duplicate, Save as step, Move and Delete, with Undo. Restore built-in workflows, in the menu next to New workflow, brings back a built-in you deleted or changed. Deleting a run deletes its agents and their open questions.',
      },
      {
        term: 'Run defaults',
        desc: 'The Run defaults tab in Workflows sets what new runs start with: when to ask, a spend cap, which providers get the next step and guidance. Use providers with room left sends steps to the provider with room. A run keeps the copy of the rules it started with.',
      },
      {
        term: 'Orchestrated',
        desc: 'Give a goal and let a model pick each next step with a reason, until it says done or blocked. Hints steer it while it runs, with several lines, markdown and images.',
      },
      {
        term: 'Pause and resume',
        desc: 'Pause lets the step in flight finish and starts nothing new. Resume picks up where the run was, Skip step cancels the step that is running, and Stop run ends it now. A step quiet for 15 minutes offers Ask it to continue.',
      },
      {
        term: 'When to ask',
        desc: 'Ask before each step, Ask after the plan or Run on its own. Ask after the plan waits once, on the plan: Review plan opens it in a drawer, and Approve runs the rest without you. A guard stops an agent after 4 unattended turns in an hour.',
      },
      {
        term: 'Open questions',
        desc: 'Each question is one card: pick an answer with its number and press Enter, or write something else. The Questions view lists what waits on you, and the same card sits in the transcript. A blocking question holds its step until you answer or choose Send as message, and Let an agent decide hands it to another agent.',
      },
    ],
    links: [{ label: 'Open Workflows', target: { kind: 'studio', studio: { kind: 'workflow' } } }],
  },
  {
    id: 'context',
    group: 'task',
    title: 'Shared context and decisions',
    concept: 'context',
    lead: 'What one agent learns, the next one reads. The goal, decisions and a running summary travel with the session.',
    points: [
      {
        term: 'Decisions',
        desc: 'Each decision gets a number and a byline. A decision Goodboy records keeps why it was made. Click one in the context drawer to open it and edit or remove it. A removal takes effect at once and can be undone while the drawer stays open.',
      },
      {
        term: 'Running summary',
        desc: 'After each turn, State, Next and Learned are updated for the next agent, and an edit you made is kept.',
      },
      {
        term: 'Context drawer',
        desc: 'Open the goal, decisions and summary from any session page, and Copy context. A dot on Context means something changed since you last looked, and those changes come first. Context updates, at the top, shows the last update with its model and cost, and Update now queues one. Learned lists what agents explained about your topics, for you only, with Dismiss and Undo.',
      },
      {
        term: 'Visible to',
        desc: 'Each tab of the drawer says which roles receive it. Reviewers, debuggers and resolvers also read the decisions.',
      },
      {
        term: 'What the agent received',
        desc: 'The top of each chat shows the parts of its brief, and View as sent shows the exact text.',
      },
    ],
    links: [],
  },
  {
    id: 'tools',
    group: 'task',
    title: 'Tools, integrations and Tasks',
    concept: 'inbox',
    lead: 'Connect GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack once. Agents on any provider can use them, and you work from one list of Tasks.',
    points: [
      {
        term: 'Agents use your tools',
        desc: 'An agent asks Goodboy and Goodboy makes the call, so your keys never reach the agent. Keys stay in your system credential store.',
      },
      {
        term: 'Tasks',
        desc: 'Issues, pull requests, threads and errors from your connected tools in one list, grouped by day. Paste a code like HBL-412 or a link to open any issue. Sentry errors, and GitHub or GitLab items when several projects live on that host, filter by project.',
      },
      {
        term: 'Start from anything',
        desc: 'Start from an issue, a Slack thread or an error, with the brief already drafted, or Review pull request on one waiting for you. Link to a session attaches the item to one you already have, and Link work on a session, or L, searches your trackers from there. Link a task to This session, This branch or Whole workspace, and pick whether merging closes it.',
      },
      {
        term: 'Task links',
        desc: 'A task chip opens the task. Unlink, Stop tracking and Take off this branch act at once and show an Undo toast, and ⌘Z undoes the last one when focus is not in a text field. The Log keeps the event with Re-link. Put on a branch sits on the branch row.',
      },
      {
        term: 'Slack',
        desc: 'Pick the channels and what agents may do there. Replies default to Ask first and wait for your Send.',
      },
      {
        term: 'Permissions',
        desc: 'The mode picker under the message box says what agents may do in this session. A mode a provider cannot honor runs as a stricter one.',
      },
    ],
    links: [
      {
        label: 'Open Tasks',
        target: { kind: 'studio', studio: { kind: 'inbox', focus: null } },
      },
      {
        label: 'Open Integrations',
        target: { kind: 'studio', studio: { kind: 'settings', focus: { scope: 'tools' } } },
      },
    ],
  },
  {
    id: 'review',
    group: 'task',
    title: 'Review, resolve and the Branch page',
    concept: 'resolve',
    lead: 'Read the code, turn review comments into commits, and merge without leaving the app. It all happens on one Branch page.',
    points: [
      {
        term: 'Branch page',
        desc: 'One page per branch, with the tabs Comments, Files, Commits and Checks, all on one centred column. A branch chip in the header switches branches or starts a new one. It opens the same way from the palette, a notification, a chat card or the board. Up is the crumb on the left, and Back walks your history.',
      },
      {
        term: 'Comments',
        desc: "The review threads of the branch and the open thread beside them. Each comment is Working, Needs you, Ready, Couldn't fix or Done, and the list groups by those words with Needs you on top. Fix writes each fix as a local commit and drafts the reply, and you accept, edit or skip it. Select several comments and Fix N opens a panel beside the list to pick the model; one agent then works through them in order, in its own copy of the branch. Fix 9, Use the recommended answers, Retry and Accept 5 act on many comments at once, and Accept has Undo.",
      },
      {
        term: 'Fix run',
        desc: "A fix run is one agent in one copy of the branch. A line under the tabs says what it is doing and counts the comments by word, each a filter. The agent asks only when a comment reads two ways, and the question shows in the comment's thread and in its transcript. Open fix run shows the transcript in a drawer beside Comments, with the commits it made.",
      },
      {
        term: 'Files',
        desc: 'The changed files as a tree in a rail at the left edge, which never moves the page, beside the code, which reads as one diff in the order of the tree, with a ring on each folder that fills as you mark files Viewed, a filter, Unviewed and With notes. Display holds Unified, Split and Wrap long lines. Comment on a line or on a whole file with Comment on file, or quote a line into a note or a question for an agent. J and K move between files, V marks one viewed, / filters, and ⌘⇧B hides the tree. Write review is a form with line comments, the verdict and a summary, sent with Approve, Request changes or Submit comments.',
      },
      {
        term: 'Notes',
        desc: 'Add note on a line saves it with the project and branch you are on. It counts in Notes N on the Files tab, where the Notes drawer lists it and Fix starts an agent on it, and Move N to review draft takes the open ones into a review draft. A note an agent works on cannot be closed or deleted. Notes without a branch wait in Unassigned notes on the Session overview, where each has Move to and Discard, and Discard all clears the list with Undo.',
      },
      {
        term: 'Review sources',
        desc: 'The picker lists each pull request or merge request of the session, on GitHub, GitLab or Bitbucket, and Notes on this machine. Bitbucket cannot resolve a thread, so its comments offer Reply.',
      },
      {
        term: 'What git says',
        desc: 'A comment reads Already on origin or Looks fixed when the branch already holds its fix, and Fix went missing when the commit is gone. Re-check asks a read-only agent whether the fix is still needed.',
      },
      {
        term: 'Checks',
        desc: 'The CI runs of a GitHub pull request, grouped as Failing, Running, Passed and Skipped, with the failing step. Checks, reviewers and review requests are read apart, so a check that cannot be read says why and names the fix, and Merge says Checks unknown. Whether it can merge reads in plain words, a blocked Merge says why beside it, and Merge and Close confirm under the header.',
      },
      {
        term: 'Push',
        desc: 'One Push in the Branch header. Select the commits, then Push N shows an inline preview before it pushes the fixes, posts the replies and resolves the threads where the provider allows it.',
      },
      {
        term: 'Refresh',
        desc: 'A pull request an agent or your terminal opened shows up when the turn ends or when you come back to the window. Refresh in the session header, or ⌘⇧R, reads it right away.',
      },
      {
        term: 'Write it',
        desc: 'A pull request title, description and changelog entry in the format your repo uses.',
      },
    ],
    links: [
      {
        label: 'Open Replies and commits',
        target: {
          kind: 'studio',
          studio: { kind: 'settings', focus: { scope: 'workspace', section: 'review-replies' } },
        },
      },
    ],
  },
  {
    id: 'history',
    group: 'task',
    title: 'Branch history and cleanup',
    concept: 'history',
    lead: 'Tidy a branch before you ship it, and decide what happens to it after it merges.',
    points: [
      {
        term: 'Commits tab',
        desc: 'The Commits tab of the Branch page shapes the history. Drag a commit to move it or onto another to fold it in, or reword, squash or drop it from the row. A folded commit chooses Keep title, Keep both or Separate. Now and After Apply sit side by side. Apply tries the plan on a temporary copy, and your branch moves only when it comes out clean. It also folds the resolve commits into their originals or into one commit before you push, with a preview and an Undo.',
      },
      {
        term: 'Conflicts ahead of time',
        desc: 'See which files would conflict while you edit the plan, without touching your checkout.',
      },
      {
        term: 'Push and restore',
        desc: "Apply and update online replaces the online branch only when nothing newer is there, so it never overwrites a teammate's work. Every rewrite saves a backup, and Backups restores it for 30 days.",
      },
      {
        term: 'After a merge',
        desc: 'Choose Ask first, Delete on this Mac or Also on origin for merged branches. A branch with later commits or uncommitted changes is left alone.',
      },
    ],
    links: [
      {
        label: 'Open workspace settings',
        target: {
          kind: 'studio',
          studio: { kind: 'settings', focus: { scope: 'workspace', section: 'after-merge' } },
        },
      },
    ],
  },
  {
    id: 'artifacts',
    group: 'task',
    title: 'Artifacts: reports and wireframes',
    concept: 'artifacts',
    lead: 'Plans, reports and wireframes live next to the task instead of inside a chat, with who made each one and what it was built from.',
    points: [
      {
        term: 'Plans',
        desc: 'A plan can give each part done-when checks and the files it expects to touch, and Run plan turns each part into a sub-agent.',
      },
      {
        term: 'Plan beside the planner',
        desc: 'In the planner chat and its Brief a plan is one row. Press it to read the plan in a drawer, where one button moves it on, Approve or Run plan, and Edit changes it by hand. Approve moves the run on, and one toast offers Follow the run. Expand and Open in Artifacts sit in its menu. While the planner reworks it, the drawer says Revising to v2 and the button is off.',
      },
      {
        term: 'Comments on a plan',
        desc: 'Point at a part or a few words of a plan and leave a comment. Comments stay drafts until Send to planner posts them, and each reads Addressed or Not changed in v2 when the new version lands.',
      },
      {
        term: 'Reports',
        desc: 'Read a report as one document with an outline, or open the same file in a browser.',
      },
      {
        term: 'Wireframes',
        desc: 'Before drawing, two scouts read your code, one for screens and one for data. Compare two versions side by side and restore any of them.',
      },
      {
        term: 'Revisions',
        desc: 'Restoring an earlier version adds it as a new revision, so nothing later is lost.',
      },
      {
        term: 'By state',
        desc: 'Artifact lists group into Needs you, Ready, Running, Ran and Recently deleted, and New marks one from the last day you have not opened. Delete has Undo, and Recently deleted restores.',
      },
    ],
    links: [],
  },
  {
    id: 'storage',
    group: 'task',
    title: 'Storage and security findings',
    concept: 'storage',
    lead: 'See what Goodboy keeps on disk, free space safely, and catch a secret before it travels.',
    points: [
      {
        term: 'Worktree folders',
        desc: 'Folders by repo, with their size, why each exists and whether it is safe to remove. Folders with changes or running agents are skipped, with the reason.',
      },
      {
        term: 'Branches',
        desc: 'Branches has its own page: each branch with its session, its state and whether it still exists on origin, counted as safe to delete or needing a look. Recently deleted restores a branch you removed.',
      },
      {
        term: 'Other tools',
        desc: 'Storage also lists the Claude Code, Codex and Cursor folders on this Mac, read only, with their size and how much of it came from Goodboy sessions.',
      },
      {
        term: 'Scope',
        desc: 'Clean up this workspace, other workspaces or removed ones, each with its weight.',
      },
      {
        term: 'Security findings',
        desc: 'Saving a script checks it for keys and tokens. Not a secret dismisses a finding, and Flag again brings it back.',
      },
    ],
    links: [
      {
        label: 'Open Storage',
        target: {
          kind: 'studio',
          studio: { kind: 'settings', focus: { scope: 'app', section: 'storage' } },
        },
      },
      {
        label: 'Open Branches',
        target: {
          kind: 'studio',
          studio: { kind: 'settings', focus: { scope: 'app', section: 'branches' } },
        },
      },
      {
        label: 'Open Security findings',
        target: {
          kind: 'studio',
          studio: { kind: 'settings', focus: { scope: 'app', section: 'security-findings' } },
        },
      },
    ],
  },
  {
    id: 'settings',
    group: 'task',
    title: 'Settings, export and import',
    concept: 'settings',
    lead: 'App settings apply everywhere, workspace settings to one workspace. Your whole setup can move to another machine.',
    points: [
      {
        term: 'Settings rail',
        desc: 'Settings opens on the page you opened last, or General the first time, and takes over the left column with Back to app and Search settings on top, open or folded. The rail lists App, Workspace, Providers & models and Integrations, and a dot marks a page that needs you. Every page is also in the palette. Drag the edge of a rail to resize it.',
      },
      {
        term: 'App and workspace',
        desc: 'Theme, updates and shortcuts are app-wide. Projects, About you, New sessions, After merge, Replies and commits, Permissions and Skills are pages of a workspace.',
      },
      {
        term: 'Copy and restore',
        desc: 'Copy settings from another workspace, or Restore defaults, previews every change before it applies. A field that differs from its default has a dot and its own Reset.',
      },
      {
        term: 'Open with',
        desc: 'In General, pick the editor worktrees open in and the browser for links and artifacts. Browser starts at System default and says when the one you chose is gone.',
      },
      {
        term: 'Export',
        desc: 'Pick what to take along: workspaces, projects, workflows, scripts, rules and preferences. Keys and sign-ins stay out.',
      },
      {
        term: 'Import',
        desc: 'Import shows what it adds before writing anything. Imported integrations ask you to sign in again.',
      },
      {
        term: 'Backup before a data update',
        desc: 'Before an update changes your data, Goodboy makes a full copy and keeps the last two.',
      },
    ],
    links: [
      {
        label: 'Open Settings',
        target: { kind: 'studio', studio: { kind: 'settings', focus: { scope: 'home' } } },
      },
      {
        label: 'Open Backup',
        target: {
          kind: 'studio',
          studio: { kind: 'settings', focus: { scope: 'app', section: 'backup' } },
        },
      },
    ],
  },
  {
    id: 'updates',
    group: 'task',
    title: "Updates and what's new",
    concept: 'updates',
    lead: "Updates download in the background, and What's new shows what changed.",
    points: [
      {
        term: 'Restart when ready',
        desc: 'With agents running, Restart when they finish waits for them.',
      },
      {
        term: "What's new",
        desc: 'Searchable release notes inside the app. After an update, one page covers the releases you skipped. Only releases that update your data in one direction carry a mark in the list.',
      },
      {
        term: 'Links into the app',
        desc: 'A change can open the screen it touched, and some show before and after pictures.',
      },
      {
        term: 'Report a bug',
        desc: 'The report shortcut opens a one-line report from any screen. What gets sent shows exactly what leaves, and a crash from last launch can be reported from its toast.',
      },
    ],
    links: [
      { label: "Open What's new", target: { kind: 'studio', studio: { kind: 'changelog' } } },
    ],
  },
  {
    id: 'keyboard',
    group: 'task',
    title: 'Keyboard',
    concept: 'shortcuts',
    lead: 'Most of Goodboy works from the keyboard. One list drives the keys, the shortcut page and the tooltips.',
    points: [
      {
        term: 'Command palette',
        desc: 'Opens on what you are looking at. In a session it lists Next steps first, then its actions in the order its state calls for, then Runs and recent places; on the Board, the sessions that need you come first. Start a run confirms before it starts. Type a few letters to find sessions of every workspace, agents, plans, pages, scripts and actions. The right arrow shows every action of a row. Any search starts with Ask in Chat. Copy worktree path copies where a session works.',
      },
      {
        term: 'Search',
        desc: 'Finds sessions, messages, agents, plans, decisions, questions, issues, pull requests, branches, workflows and diff comments, filtered by type, project, provider, status or date. Walk the matches in a view with ⌘G. In a focused terminal it finds in the scrollback.',
      },
      {
        term: 'Right click',
        desc: 'Any session, agent, run, artifact, pull request, worktree row, diff file or message opens a menu with every action it has. Shift+F10 opens it on the focused row.',
      },
      {
        term: 'Composer keys',
        desc: 'In a message, Enter sends and ⇧Enter adds a line. In a document, Enter adds a line and ⌘Enter saves. Start agent and the issue kickoff start on Enter, and Keys from before 0.15.5, in Shortcuts, brings back the old ones.',
      },
      {
        term: 'Esc',
        desc: 'Closes the menu, panel or dialog in front. It never takes the window out of macOS full screen.',
      },
    ],
    links: [
      { label: 'Open the command palette', target: { kind: 'palette' } },
      {
        label: 'See all shortcuts',
        target: {
          kind: 'studio',
          studio: { kind: 'settings', focus: { scope: 'app', section: 'shortcuts' } },
        },
      },
    ],
    extra: 'shortcuts',
  },
  {
    id: 'listens',
    group: 'task',
    title: 'How Goodboy listens',
    concept: 'shortcuts',
    lead: 'The same few rules hold on every screen. This page reads the same constants the app does, so it cannot fall behind.',
    points: [],
    links: [],
    extra: 'listens',
  },
  {
    id: 'tokens',
    group: 'reference',
    title: 'Tokens and cost',
    concept: 'budget',
    lead: "Every message, yours and the agent's, is turned into tokens before billing. One token is about three quarters of an English word.",
    points: [
      {
        term: 'Input tokens',
        desc: 'Everything sent into the model: instructions, history, tool results and your latest message. It grows every turn, which is why later turns cost more.',
      },
      {
        term: 'Cached input tokens',
        desc: 'Parts of the prompt the provider reuses from a recent call, billed at a fraction of the input rate when the provider supports it.',
      },
      {
        term: 'Output tokens',
        desc: 'What the model writes back, text plus tool calls. The most expensive kind.',
      },
      {
        term: 'Context window',
        desc: 'Each model has a ceiling on how much fits in one call. The context meter in each turn footer shows how full it is.',
      },
    ],
    links: [],
  },
  {
    id: 'tips',
    group: 'reference',
    title: 'Tips',
    concept: 'suggestion',
    lead: 'Habits that pay off across sessions.',
    points: [
      {
        term: 'Triage the board by lane',
        desc: 'Start with needs you, then in review, and let the running ones run.',
      },
      {
        term: 'One short goal per session',
        desc: 'Long open-ended sessions drift. When the scope grows, start a new one.',
      },
      {
        term: 'Light models for looking around',
        desc: 'A light model can search, list and summarize at a fraction of the price. Move up only when the reasoning gets hard.',
      },
      {
        term: 'Queue your follow-ups',
        desc: 'Type while an agent works. Your message waits for its next turn instead of cutting it short.',
      },
      {
        term: 'Watch spend in the top bar',
        desc: "Today's spend for the workspace is always visible up top.",
      },
    ],
    links: [],
  },
  {
    id: 'legend',
    group: 'reference',
    title: 'Legend',
    concept: 'appearance',
    lead: 'What the colors mean across the app.',
    points: [],
    links: [],
    extra: 'legend',
  },
];
