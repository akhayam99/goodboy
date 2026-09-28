import type { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { GuideLink } from './guideTarget';

export type GuideGroup = 'start' | 'task' | 'reference';

export type GuideExtra = 'stages' | 'shortcuts' | 'legend';

export type GuidePoint = {
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
        term: 'A branch only when needed',
        desc: 'A project gets its own worktree and branch only when an agent needs to edit it, so your own checkout stays as it is.',
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
        desc: 'Tell agents once who you are and how you like to work. Settings shows which role reads each part.',
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
      { label: 'Add a workspace', target: { kind: 'studio', studio: { kind: 'addWorkspace' } } },
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
        term: 'Usage limits',
        desc: 'The top bar shows each provider as its icon and two bars, the 5-hour window and the week. A bar changes color as it fills, and the tooltip gives the percentage and when it resets.',
      },
      {
        term: 'Use reset',
        desc: 'When Codex offers a free reset, the provider page shows it with its expiry, and warns you when spending it now would waste it.',
      },
      {
        term: 'Fallback',
        desc: 'When a provider runs out, the turn can move to another connected provider, and the chat records where it went.',
      },
      {
        term: 'Cost',
        desc: 'Impact shows what got done and what it cost. A monthly cap per provider warns you before you reach it.',
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
        desc: 'Choose an issue from your tools or the Inbox. Goodboy drafts a short title and goal linked back to it, and you keep or edit them. Then run it through the same workflow builder, or ask an agent. A Sentry error or a GitHub or GitLab item opens in its project and says why.',
      },
      {
        term: 'Run a workflow',
        desc: 'The same workflow builder as in a session: pick Orchestrated, Custom or Preset, see and edit the plan, then Start workflow creates the session and starts the run.',
      },
      {
        term: 'Ask an agent',
        desc: 'Ask a question about the code. Scout is the default and maps an unfamiliar repo before you plan.',
      },
      {
        term: 'Chat',
        desc: 'Chat, right of Board, answers a question about the whole workspace without a session. It only reads, on Claude or Codex, and Start work turns an answer into a new session or a message to one that is running.',
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
    lead: 'The home screen. Each session sits in a column based on what is happening in it, so you never move cards by hand.',
    points: [
      {
        term: 'Session card',
        desc: 'Pull request, issue and project chips, step progress, agent count, age and cost, plus one suggested action.',
      },
      {
        term: 'Done and archived',
        desc: 'Finished and archived sessions fold into two icons at the side of the board. Archive keeps everything and can be undone. Delete removes it for good.',
      },
      {
        term: 'Select many',
        desc: 'Lasso or modifier-click cards across columns, then archive, restore or delete them together.',
      },
      {
        term: 'Now chip',
        desc: 'The top bar counts sessions that need you and running ones, from any screen.',
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
        desc: 'Enter queues your message for its next turn, and ⌘Enter interrupts and sends it now. Stop keeps what it wrote and offers Continue. After a restart or an update, agents that were working pick up where they stopped, and one that cannot reads Stopped by restart and offers Resume.',
      },
      {
        term: 'Workflows',
        desc: 'Start from Refactor, Plan and ship or Fix a bug, or build your own. Each step has its own provider, model and effort. Deleting a run deletes its agents and their open questions.',
      },
      {
        term: 'Orchestrated',
        desc: 'Give a goal and let a model pick each next step with a reason, until it says done or blocked. Hints steer it while it runs.',
      },
      {
        term: 'Autorun',
        desc: 'A run can move to its next step without you. A guard stops an agent after 4 unattended turns in an hour.',
      },
      {
        term: 'Open questions',
        desc: 'Each question is one card: pick an answer with its number and press Enter, or write something else. The Questions lens lists what waits on you, and the same card sits in the transcript and on the Brief. A blocking question holds its step until you answer, and Let an agent decide hands it to another agent.',
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
        desc: 'Open the goal, decisions and summary from any session page, and Copy as brief. A dot on Context means something changed since you last looked, and those changes come first.',
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
    title: 'Tools, integrations and the Inbox',
    concept: 'inbox',
    lead: 'Connect GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack once. Agents on any provider can use them, and you work from one Inbox.',
    points: [
      {
        term: 'Agents use your tools',
        desc: 'An agent asks Goodboy and Goodboy makes the call, so your keys never reach the agent. Keys stay in your system credential store.',
      },
      {
        term: 'Inbox',
        desc: 'Issues, pull requests, threads and errors from your connected tools in one list, grouped by day. Paste a code like HBL-412 or a link to open any issue. Sentry errors, and GitHub or GitLab items when several projects live on that host, filter by project.',
      },
      {
        term: 'Start from anything',
        desc: 'Launch a session from an issue, a Slack thread or an error, with the brief already drafted. Link to a session attaches the item to one you already have, and Link work on a session, or L, searches your trackers from there.',
      },
      {
        term: 'Slack',
        desc: 'Pick the channels and what agents may do there. Replies default to Ask me first and wait for your Send.',
      },
      {
        term: 'Permissions',
        desc: 'The mode picker under the message box says what agents may do in this session. A mode a provider cannot honor runs as a stricter one.',
      },
    ],
    links: [
      {
        label: 'Open the Inbox',
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
    title: 'Review, resolve and the PR page',
    concept: 'resolve',
    lead: 'Read the diff, turn review comments into commits, and merge without leaving the app.',
    points: [
      {
        term: 'Diff',
        desc: 'Split or unified, with word-level highlights and a Viewed tick per file. Quote a line into a note or a question for an agent. The header offers the next step for the branch.',
      },
      {
        term: 'Review',
        desc: 'The comments on the left, grouped as Open, Waiting for the push and Done, and the one you picked on the right. Draft fixes for N writes each fix as a local commit and drafts the reply, and you accept, edit or skip it.',
      },
      {
        term: 'Push',
        desc: 'Push N in the Review header pushes the fixes, posts the replies and resolves the threads, after a confirm under the header.',
      },
      {
        term: 'Pull request page',
        desc: 'Whether a GitHub pull request can merge, in plain words, with details and checks. The next step is the one main action, and Merge and Close confirm under the header.',
      },
      {
        term: 'Layers',
        desc: 'The pull request, its Diff and its Review open as one path in the trail, and Back walks it.',
      },
      {
        term: 'Write review',
        desc: 'A form under the diff: line comments, the verdict and a summary, sent with Approve, Request changes or Submit comments.',
      },
      {
        term: 'Refresh',
        desc: 'A pull request an agent or your terminal opened shows up when the turn ends or when you come back to the window. Refresh in the session header, or ⌘⇧R, reads it right away.',
      },
      {
        term: 'Write it for me',
        desc: 'A pull request title, description and changelog entry in the format your repo uses.',
      },
    ],
    links: [
      {
        label: 'Open Review replies',
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
        term: 'Rewrite history',
        desc: 'Drag a commit to move it or onto another to fold it in, or rename, squash or remove it from the row. A folded commit chooses Keep title, Keep both or Separate. Now and After Apply sit side by side. Apply tries the plan on a temporary copy, and your branch moves only when it comes out clean.',
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
        desc: 'Choose Ask me, Delete on this Mac or Also on origin for merged branches. A branch with later commits or uncommitted changes is left alone.',
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
        desc: 'Sorted into Safe to delete and Needs a look, each with its session and whether it still exists on origin.',
      },
      {
        term: 'Scope',
        desc: 'Clean up this workspace, other workspaces or removed ones, each with its weight. When 1 GB or more can go, the top bar shows Free N GB and opens Storage.',
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
        term: 'App and workspace',
        desc: 'Theme, updates and shortcuts are app-wide. Projects, defaults, permissions and review replies belong to a workspace.',
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
        target: {
          kind: 'studio',
          studio: { kind: 'settings', focus: { scope: 'app', section: 'general' } },
        },
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
    title: 'Updates and changelog',
    concept: 'updates',
    lead: 'Updates download in the background, and the changelog shows what changed.',
    points: [
      {
        term: 'Restart when ready',
        desc: 'With agents running, Restart when they finish waits for them.',
      },
      {
        term: 'Changelog',
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
      { label: 'Open the changelog', target: { kind: 'studio', studio: { kind: 'changelog' } } },
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
        desc: 'Opens on what you are looking at, with its actions first. Type a few letters to find sessions of every workspace, agents, plans, pages, scripts and actions. The right arrow shows every action of a row. Any search starts with Ask in Chat. Copy worktree path copies where a session works.',
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
        term: 'Triage the board by column',
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
