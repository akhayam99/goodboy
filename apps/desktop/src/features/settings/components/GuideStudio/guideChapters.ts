import type { GuideLink } from './guideTarget';
import { NAMES } from '../../../../shared/names';

export type GuideGroup = 'start' | 'daily' | 'housekeeping' | 'reference';

export type GuideExtra = 'stages' | 'shortcuts' | 'listens' | 'legend';

type GuidePoint = {
  readonly term: string;
  readonly desc: string;
};

export type GuideChapter = {
  readonly id: string;
  readonly group: GuideGroup;
  readonly title: string;
  readonly lead: string;
  readonly note?: GuidePoint;
  readonly points: ReadonlyArray<GuidePoint>;
  readonly links: ReadonlyArray<GuideLink>;
  readonly extra?: GuideExtra;
};

export const GUIDE_GROUP_ORDER: ReadonlyArray<GuideGroup> = [
  'start',
  'daily',
  'housekeeping',
  'reference',
];

export const GUIDE_GROUP_LABEL: Readonly<Record<GuideGroup, string>> = {
  start: 'Start here',
  daily: 'Daily work',
  housekeeping: 'Housekeeping',
  reference: 'Reference',
};

export const GUIDE_CHAPTERS: ReadonlyArray<GuideChapter> = [
  {
    id: 'overview',
    group: 'start',
    title: 'What is Goodboy',
    lead: 'A desk for running coding agents side by side. Each task is a session with its own agents, branches and history.',
    note: {
      term: "Goodboy runs each provider's own CLI",
      desc: 'It runs each CLI as a subprocess and streams its events, so your sign in, usage and plan stay inside it. Goodboy adds the workspace, the board and the orchestration.',
    },
    points: [
      {
        term: 'Setup',
        desc: 'The first launch walks through Agents, Workspace, Tools and First session, and Tools can wait. Home lists your workspaces under New workspace, ⌘N, and offers Resume setup until you have one.',
      },
      {
        term: 'This Guide',
        desc: 'One chapter per page. Search the rail and press Enter to land on the point you need. The Guide opens from the Goodboy row, Help in the menu bar or the palette.',
      },
    ],
    links: [],
  },
  {
    id: 'words',
    group: 'start',
    title: 'Words',
    lead: 'The words Goodboy uses, one sentence each.',
    points: [
      {
        term: 'Workspace',
        desc: 'Where you work, named after what you work on, with your folders, connected tools and sessions.',
      },
      {
        term: 'Folder',
        desc: 'One git repository or plain folder inside a workspace, with its own scripts and settings.',
      },
      {
        term: 'Session',
        desc: 'One task with one goal and its own agents, limit and notes, moving across the board until it is done.',
      },
      {
        term: 'Agent',
        desc: 'One chat in a session with its own provider and model; every session has at least one.',
      },
      {
        term: 'Turn',
        desc: 'One message from you and the answer, which adds to what the model reads.',
      },
      {
        term: 'Worktree and branch',
        desc: 'A copy of a folder on its own branch, named gb- and six characters, so a session never touches your checkout.',
      },
      {
        term: NAMES.spendCap,
        desc: 'The most a session, a run or a provider may spend, with a warning as the spend nears it.',
      },
    ],
    links: [],
  },
  {
    id: 'folders',
    group: 'daily',
    title: 'Workspaces and folders',
    lead: 'A workspace holds what you work on: folders, git repositories or plain ones, and one session can work across several of them.',
    points: [
      {
        term: 'One window per workspace',
        desc: 'Open each workspace in its own window, so switching never stops a running agent; while agents run, the switcher offers a new window. After a reload or an update, every window comes back.',
      },
      {
        term: 'Add a folder',
        desc: `${NAMES.addFolder}, in the workspace switcher or on Settings, Workspace, ${NAMES.folders}, adds a repository or a plain folder. A star and a one line description on a folder go into every agent brief.`,
      },
      {
        term: 'Start from scratch',
        desc: 'Inside New workspace, it makes the folder, starts a git repository with a first commit and opens a first session. Publish later puts it on GitHub.',
      },
      {
        term: 'A branch only when needed',
        desc: 'A folder gets a worktree and branch only when an agent edits it, so your checkout stays as it is. New sessions, in workspace settings, names the branches.',
      },
      {
        term: 'Repositories',
        desc: 'Beside the workspace name in the top bar, it says which repos have something to pull, such as 3 behind or Diverged. Goodboy fetches every 5 minutes and never moves a local branch.',
      },
      {
        term: 'About you',
        desc: 'Tell agents once who you are and how you work. See who reads what shows which role reads each part.',
      },
    ],
    links: [
      {
        label: `Open ${NAMES.folders}`,
        target: {
          kind: 'studio',
          studio: { kind: 'settings', focus: { scope: 'workspace', section: 'projects' } },
        },
      },
      { label: NAMES.newWorkspace, target: { kind: 'studio', studio: { kind: 'addWorkspace' } } },
    ],
  },
  {
    id: 'plain-folders',
    group: 'daily',
    title: 'Folders without git',
    lead: 'Agents edit a folder without git in place, and every change can be put back.',
    points: [
      {
        term: 'Code or Documents',
        desc: 'Picking a folder asks what it is for. Change it later in Settings, Folders.',
      },
      {
        term: 'One writer at a time',
        desc: 'One session writes in a folder at a time. The next waits its turn.',
      },
      {
        term: 'Changes',
        desc: "The session rail lists each turn's files. Restore a file or a whole turn, then Undo restore if you change your mind.",
      },
      {
        term: 'Saved versions',
        desc: 'Each writing turn saves what it may change first, for 30 days after the session ends.',
      },
      {
        term: 'Track it with git',
        desc: 'Add git for branches and pull requests. The first commit is shown before it happens.',
      },
      {
        term: 'Git set up outside',
        desc: 'Code folders move to branches between turns. Documents folders ask first.',
      },
    ],
    links: [
      {
        label: `Open ${NAMES.folders}`,
        target: {
          kind: 'studio',
          studio: { kind: 'settings', focus: { scope: 'workspace', section: 'projects' } },
        },
      },
      { label: NAMES.newWorkspace, target: { kind: 'studio', studio: { kind: 'addWorkspace' } } },
    ],
  },
  {
    id: 'providers',
    group: 'daily',
    title: 'Providers and limits',
    lead: 'Each provider connects with a sign in you already have or an API key. Goodboy watches your plan windows and your spend.',
    points: [
      {
        term: 'One page per provider',
        desc: `${NAMES.providersAndModels}, in Settings, has a page per provider with usage, the models in your picker, permissions and your account. Test connection makes a real account call.`,
      },
      {
        term: 'Usage in the top bar',
        desc: 'Each provider shows its mark and one bar, the tighter of the 5-hour window and the week, with a percent past 70%. Rest on it for the reset time.',
      },
      {
        term: 'When a provider is out',
        desc: 'Models lists the providers of the workspace in order, each On, Backup only or Off, and new work starts on the first On provider. Drag a row, or press Alt and an arrow, to move it.',
      },
      {
        term: 'Auto in Models',
        desc: 'The model setting, not the Auto agent: each role runs on a rung of one ladder per provider, moved by step size. Models shows the pick. A model turned off is left out.',
      },
      {
        term: 'Fallback',
        desc: 'When a provider runs out, the turn can move to the next provider the order allows, and the chat says where it went.',
      },
      {
        term: 'Use reset',
        desc: 'When Codex offers a free reset, its page shows the expiry and Use reset, and warns when spending it now would waste it.',
      },
      {
        term: NAMES.spendCap,
        desc: "A session's limit sits on the spend at the foot of its rail. A provider's Monthly limit, with Warn at for the warning, sits in Impact, Spend.",
      },
    ],
    links: [
      {
        label: `Open ${NAMES.providersAndModels}`,
        target: { kind: 'studio', studio: { kind: 'settings', focus: { scope: 'providers' } } },
      },
      {
        label: 'Open Impact, Spend',
        target: { kind: 'studio', studio: { kind: 'impact', scope: { kind: 'spend' } } },
      },
    ],
  },
  {
    id: 'kickoff',
    group: 'daily',
    title: 'New session',
    lead: 'A session is one task: write it or pick it from Tasks, then pick the kind of run. It stays a draft until you press Start or Start blank.',
    points: [
      {
        term: 'What kind of run?',
        desc: 'Pick Workflow or Agent, then Orchestrated or Preset, Agent or Auto agent. One form follows, with only that kind.',
      },
      {
        term: NAMES.startARun,
        desc: 'Not sure? Describe it and Auto picks a workflow or an agent; @Scout starts that role. Esc closes the draft, asking first if you wrote something.',
      },
      {
        term: 'Start on a task',
        desc: 'From Tasks, opens New session with the issue linked and its goal written in. Pick from Tasks does the same on the page.',
      },
      {
        term: 'Where',
        desc: 'Reads Auto picks: an agent adds the folder it must edit. Pin folders here from Suggested or All folders.',
      },
      {
        term: 'New menu',
        desc: "New, in a session's Overview header, opens Start a run on Runs, or Write a report and Draw a wireframe, each a form in a pane.",
      },
      {
        term: 'Start blank',
        desc: 'Opens the session on its Overview, to add the goal, folders and work later. Its short title reads Named by Goodboy until you rename it.',
      },
      {
        term: 'Chat',
        desc: 'A sidebar door that answers questions about the whole workspace without a session and never changes a file. Start work from chat drafts a session from an answer.',
      },
    ],
    links: [{ label: 'Start a new session', target: { kind: 'newSession' } }],
  },
  {
    id: 'board',
    group: 'daily',
    title: 'Board',
    lead: 'The Sessions page of the sidebar. Each session sits in a lane for what is happening in it, so you never move cards by hand.',
    points: [
      {
        term: 'Session card',
        desc: 'The title, the folder and one signal: an open question, a failed check, the pull request in its state color or the agents at work. Rest on it for age, issues and cost.',
      },
      {
        term: 'Board and List',
        desc: 'The header switches between lanes and one aligned list, and the filter beside it sorts, groups and narrows both.',
      },
      {
        term: 'Done and archived',
        desc: 'Lanes of their own, after the others. Restore brings an archived session back. Delete removes the transcript and files for good; its cost still counts in Impact.',
      },
      {
        term: 'Archive',
        desc: 'Asks first and says when agents still run: they keep running. Branches, worktrees and history stay on disk.',
      },
      {
        term: 'Select many',
        desc: 'Shift or Option click, or Select in a row menu, then Archive, Restore or Delete from the bar.',
      },
      {
        term: 'Now chip',
        desc: 'Counts running sessions and scripts from any screen, and a click lists them. Sessions that need you put an amber dot on Sessions in the sidebar.',
      },
      {
        term: 'Top bar',
        desc: "The Now chip, providers, today's spend, theme button and bell sit on the right; spend opens Impact on Spend.",
      },
    ],
    links: [{ label: 'Go to the board', target: { kind: 'board' } }],
    extra: 'stages',
  },
  {
    id: 'shell',
    group: 'daily',
    title: 'Sidebar and session rail',
    lead: 'The sidebar looks the same on every screen. A session opens its rail beside it, and the session tools sit in a thin column at the right.',
    points: [
      {
        term: 'Sidebar',
        desc: 'New session, then Sessions, Tasks, Chat, Workflows, Terminal, Impact and Monitoring, your sessions, Settings and the Goodboy row. An amber dot says sessions need you, or on Monitoring that a pinned port is down.',
      },
      {
        term: 'Session rows',
        desc: 'One line each, its mark amber when you must act and red when something broke. The funnel on Sessions holds Sort, Group, Filter and Show archived. Idle sessions move to Inactive after three days.',
      },
      {
        term: 'Pin a session',
        desc: "Pin session, in a row's right click menu, keeps it in a Pinned group on top, whatever the sort, and Move up and Move down reorder it.",
      },
      {
        term: 'Session rail',
        desc: 'Overview, Runs, Artifacts and Questions, with counts; Runs holds plans, presets, Auto and agents. Then the Projects card, one tree of folders and branches, and the Linked card.',
      },
      {
        term: 'Session actions and +',
        desc: 'The + on the Projects card adds or connects a folder, and the + on a folder row starts a new branch in it. More session actions, next to Pin, holds Archive and Delete.',
      },
      {
        term: 'Agents panel',
        desc: 'Agents, or ⌘⌥L, shows what a run or Auto started as a folding tree. An agent opens its transcript; Back to agents returns.',
      },
      {
        term: 'Session tools',
        desc: 'The icon column at the right of the session page holds Ask, Terminal, Explore, Context, Agents and Scripts, named on hover, each a pane beside the page that Esc closes. Fold session rail, or ⌥⌘B, shrinks the rail.',
      },
    ],
    links: [],
  },
  {
    id: 'agents',
    group: 'daily',
    title: 'Agents and roles',
    lead: 'An agent is one run of a provider CLI inside a session. Its role sets its instructions, its default model and what it hands back.',
    points: [
      {
        term: 'Roles',
        desc: 'Scout, Plan, Implement, Debug, Test, Review, Docs, Resolve and Generalist. Resolve answers review comments, never as a workflow step.',
      },
      {
        term: 'Talking to an agent',
        desc: 'Enter queues your message for the next turn, and ⌘Enter sends it now. Stop keeps what the agent wrote and offers Continue, and a queued message waits until the provider takes it.',
      },
      {
        term: 'Runs page',
        desc: "Every run, newest first: presets, orchestrated runs, Auto and your agents. An agent's menu holds Rename, Change model, Let Auto take it from here and Delete agent.",
      },
      {
        term: 'Auto',
        desc: 'The agent behind Start a run. It answers what it can, hands the rest to child agents of the roles it picks and goes on under a limit, listed under Runs.',
      },
      {
        term: 'Let Auto take it from here',
        desc: 'Hands Auto an older agent you started yourself; Detach from Auto takes it back. When Auto cannot decide, it reads Blocked with Retry.',
      },
      {
        term: 'Overview cards',
        desc: "The Overview shows Needs you, Running, Next, Branches and Done, each with its count, and hides an empty card. A Running row carries the run's own button. The full log sits in the session menu.",
      },
      {
        term: 'Next',
        desc: "Up to three moves that unblock the task, such as Start, Analyze or Push. It offers only what starts something; what follows sits on that run's Running row. Not now hides one, and ⌘Z brings it back.",
      },
    ],
    links: [],
  },
  {
    id: 'workflows',
    group: 'daily',
    title: 'Workflows',
    lead: 'A workflow is a list of steps you can reuse, and each step of a run gets its own agent.',
    points: [
      {
        term: 'Built in and your own',
        desc: 'Refactor, Plan and ship and Fix a bug come with the app, or build your own. A step follows its role or pins a model, and Restore built-in workflows brings one back.',
      },
      {
        term: 'Run page',
        desc: 'Agents beside a run holds its steps, Add step and the limit. The line at the end says what it waits for, with the button that moves it on, such as Review plan.',
      },
      {
        term: 'Orchestrated',
        desc: 'Give a goal and an orchestrator model picks each next step with a reason, until done or blocked. Hint the orchestrator queues a hint, and Send now reads it at once, stopping the step in flight.',
      },
      {
        term: 'Orchestrated or Auto',
        desc: 'Orchestrated is not Auto: the orchestrator only picks the next step and you steer with hints. Auto is one agent that delegates to children, and only Auto carries the Experimental marker.',
      },
      {
        term: 'Asks you and pause',
        desc: 'Asks you: Every step, After the plan or Never sets how often a run stops for you. Pause run lets the step in flight finish, and Stop run asks first.',
      },
      {
        term: NAMES.runDefaults,
        desc: 'This tab in Workflows sets what new runs start with: when it asks you, a limit and guidance. A run keeps the rules it started with.',
      },
      {
        term: 'Open questions',
        desc: 'Each question is one card: pick an answer by its number and press Enter, or write your own. Send as message frees a blocked step, and Let an agent decide hands the question over.',
      },
    ],
    links: [{ label: 'Open Workflows', target: { kind: 'studio', studio: { kind: 'workflow' } } }],
  },
  {
    id: 'context',
    group: 'daily',
    title: 'Shared context',
    lead: 'What one agent learns, the next one reads. The goal, decisions and a running summary travel with the session.',
    points: [
      {
        term: 'Decisions',
        desc: 'Each decision gets a number and a byline, and one Goodboy records keeps why. Click one in Context to edit or remove it, with Undo while the pane is open.',
      },
      {
        term: 'Running summary',
        desc: 'After each turn, State, Next and Learned are updated for the next agent, and an edit you made is kept.',
      },
      {
        term: 'Context pane',
        desc: 'Context, in the session tools or ⌘⌥C, holds the goal, decisions and summary, with Copy context. A dot on it means something changed since you looked, and Update now queues an update.',
      },
      {
        term: 'Visible to',
        desc: 'The eye on each card says which roles receive it. Planners, implementers, reviewers, debuggers and resolvers read the decisions.',
      },
      {
        term: 'Explanations',
        desc: 'List topics under Explain more when it touches, in About you, and Explanations collects what agents explained about them, with Dismiss and Undo.',
      },
      {
        term: 'What the agent received',
        desc: 'The top of each chat shows the parts of its brief, and View as sent shows the exact text.',
      },
    ],
    links: [],
  },
  {
    id: 'tasks',
    group: 'daily',
    title: 'Tasks and integrations',
    lead: 'Connect GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack once. Agents on any provider can use them, and their work lands in Tasks.',
    points: [
      {
        term: 'Agents use your tools',
        desc: 'An agent asks Goodboy and Goodboy makes the call, so your keys never reach the agent. Keys stay in your system credential store.',
      },
      {
        term: NAMES.tasks,
        desc: 'Issues, pull requests, threads and errors in one list, opening on For me: assigned to you, starred or linked to your sessions. Filters narrows by source, type and folder, and a row opens in the pane on the right.',
      },
      {
        term: 'Find any issue',
        desc: 'Paste a code like HBL-412 or a link in the search to open any issue, even one not assigned to you.',
      },
      {
        term: 'Start from anything',
        desc: 'Start session on an issue or an error opens a draft with its brief, and Review pull request starts a read-only reviewer. Link to a session attaches an item to an existing one.',
      },
      {
        term: 'Task links',
        desc: 'A Linked row in the rail opens its task. Its right click menu holds Move to, Take off this branch and Unlink from session, each with Undo, and the Log keeps Re-link.',
      },
      {
        term: 'Slack',
        desc: 'Pick the channels and what agents may do there. Replies default to Ask first and wait for your Send.',
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
    group: 'daily',
    title: 'Review and the Branch page',
    lead: 'One page per branch: its pull request, comments, files, commits and checks, so you read the code, fix review comments and merge without leaving the app.',
    points: [
      {
        term: 'Branch page',
        desc: 'Click a branch on the Projects card and its page opens in place: Pull request, Comments, Files, Commits and Checks. Rebase sits on its row. The palette, a notification or the board open the same page.',
      },
      {
        term: 'Pull request',
        desc: 'State, base, checks and whether it can merge, in plain words. Add reviewers or merge it the ways the host allows; with none yet, a create form offers Write with Scribe.',
      },
      {
        term: 'Comments',
        desc: 'Review threads and your own notes in one list, Needs you on top. A row opens a drawer with the code, the thread and Fix, Reply and Skip on F, R and S.',
      },
      {
        term: 'Fix comments',
        desc: 'In the Branch header, it runs one agent through the comments you check, in its own copy of the branch. Each ends in a fix, a reply or a question, and nothing leaves until you push.',
      },
      {
        term: 'Files',
        desc: 'The diff, with the changed files on the right and Next unviewed on top. Comment on a line or a file, then review with Approve, Request changes or Submit comments.',
      },
      {
        term: 'Checks',
        desc: 'CI runs grouped as Failing, Running, Passed and Skipped. Analyze on a failing one starts the Debugger, which reads the log and proposes a fix, with Start fix and Push in its drawer.',
      },
      {
        term: 'Push',
        desc: 'One Push in the Branch header covers every ready comment, with a preview first when something needs a decision.',
      },
    ],
    links: [
      {
        label: `Open ${NAMES.repliesAndCommits}`,
        target: {
          kind: 'studio',
          studio: { kind: 'settings', focus: { scope: 'workspace', section: 'review-replies' } },
        },
      },
    ],
  },
  {
    id: 'commits',
    group: 'daily',
    title: 'Commits',
    lead: 'The Commits section of the Branch page shapes a branch before review: move, fold, reword or drop commits, each with Undo.',
    points: [
      {
        term: 'Shape the history',
        desc: 'Drag a commit to move it, or onto another to fold it in, and reword, squash or drop it from its row. Each edit applies at once, and commits not yet online read Not pushed.',
      },
      {
        term: 'Undo and versions',
        desc: 'Undo and Redo, or ⌘Z and ⌘⇧Z, work while the page stays open. Every edit saves a backup first, and Previous versions lists them with Reset branch to this version.',
      },
      {
        term: 'Conflicts stop an edit',
        desc: 'An edit that would conflict changes nothing: the row names the file and offers Rewrite with an agent, which merges in a copy first.',
      },
      {
        term: 'Rebase',
        desc: 'Rebase on the status line moves a branch that is behind onto the latest base with git alone, no tokens, and sets your uncommitted files aside and back.',
      },
      {
        term: 'A rebase conflict asks',
        desc: 'A conflict leaves the branch as it was and asks: Resolve with Auto, Resolve myself or Keep branch as it was, with Add a hint. Auto resolves in the worktree and never pushes; Resolve myself starts the rebase in the terminal.',
      },
      {
        term: 'Rebase all',
        desc: "With two or more branches behind, Rebase all on the Projects card rebases the clean ones with git and hands conflicts to one Auto run. Rows show Rebasing, Queued or Conflict; the header has Abort. Next's rebase picker adds Also tidy commits with Auto.",
      },
      {
        term: 'Force push',
        desc: "Replaces the online branch only when nothing newer is there, so it never overwrites a teammate's work.",
      },
    ],
    links: [
      {
        label: `Open ${NAMES.branches}`,
        target: {
          kind: 'studio',
          studio: { kind: 'settings', focus: { scope: 'workspace', section: 'branches' } },
        },
      },
    ],
  },
  {
    id: 'artifacts',
    group: 'daily',
    title: 'Artifacts',
    lead: 'Plans, reports and wireframes live next to the task instead of inside a chat, with who made each and what it was built from.',
    points: [
      {
        term: 'One list',
        desc: 'All, Plans, Reports and Wireframes filter one list grouped as Needs you, Ready, Running, Consumed and Recently deleted. Each row shows one action, such as Run plan or Approve.',
      },
      {
        term: 'Plans',
        desc: 'A plan can give each part done-when checks and the files it expects to touch, and Run plan turns each part into a sub-agent.',
      },
      {
        term: 'Plan beside the planner',
        desc: 'In the planner chat a plan is one row. It opens in a drawer where Approve or Run plan moves it on and Edit changes it.',
      },
      {
        term: 'Comments on a plan',
        desc: 'Point at a part or a few words to comment. Comments stay drafts until Send to planner, and read Addressed or Not changed when the new version lands.',
      },
      {
        term: 'Reports',
        desc: 'Read a report as one document with an Outline, or open its file in a browser.',
      },
      {
        term: 'Wireframes',
        desc: 'Before drawing, two scouts read your code, one for screens and one for data. Compare two versions side by side.',
      },
      {
        term: 'Revisions',
        desc: 'Restoring an earlier version adds it as a new revision, so nothing later is lost.',
      },
    ],
    links: [],
  },
  {
    id: 'impact',
    group: 'daily',
    title: 'Impact',
    lead: 'What got done and what it cost, over 7 days, 30 days or All time.',
    points: [
      {
        term: 'Overview',
        desc: 'Sessions, pull requests merged, reviews resolved and runs by workflows, then the sessions that shipped the most.',
      },
      {
        term: 'Shipped',
        desc: 'Open and merged pull requests, review throughput, hot files and the issues your sessions linked.',
      },
      {
        term: 'Flow',
        desc: 'How long agents take, how long work waits on you or on a question, and where the flow blocks.',
      },
      {
        term: 'Spend',
        desc: "What each provider, model and session cost, deleted sessions included. A provider's Monthly limit has Save limit and Remove limit for that provider only.",
      },
      {
        term: 'How cost is counted',
        desc: 'Cost is estimated from the tokens each turn used. Tokens and cost, in Reference, explains them, and Spend links there.',
      },
    ],
    links: [
      {
        label: 'Open Impact',
        target: { kind: 'studio', studio: { kind: 'impact', scope: null } },
      },
    ],
  },
  {
    id: 'monitoring',
    group: 'daily',
    title: 'Monitoring',
    lead: 'The ports in use on this Mac, who opened them and how to stop them, on macOS and Linux.',
    points: [
      {
        term: 'Four groups',
        desc: 'Pinned holds the ports you add with Pin a port, each with your own description. Run by Goodboy, From workspace and Listening on this Mac follow, and a port shows in one only.',
      },
      {
        term: 'A pinned port down',
        desc: 'When a pinned port stops listening, Monitoring in the sidebar shows an amber dot. Rest on it to read which port.',
      },
      {
        term: 'Rows',
        desc: 'Stop and the ⋯ menu fill one cell when you rest on a row, and a right click opens the same menu: Open in browser, Pin, Hide and Copy address.',
      },
      {
        term: 'Stop',
        desc: 'Asks first and names who loses the port. A process that does not exit in time offers Force stop, and a refused stop keeps the row with the reason.',
      },
      {
        term: 'Leftovers',
        desc: 'Processes an earlier run left behind, with their age. Stop leftovers clears them.',
      },
      {
        term: 'Hidden ports',
        desc: 'Hide takes a row out of the list, and Show hidden ports brings them back.',
      },
    ],
    links: [
      { label: 'Open Monitoring', target: { kind: 'studio', studio: { kind: 'monitoring' } } },
    ],
  },
  {
    id: 'storage',
    group: 'housekeeping',
    title: 'Storage and cleanup',
    lead: 'See what Goodboy keeps on disk, free space safely, and catch a secret before it travels.',
    points: [
      {
        term: 'Worktrees',
        desc: 'The worktree folders of archived, deleted or gone sessions, with their size and whether each is safe to remove. Folders with changes or running agents are skipped, with the reason.',
      },
      {
        term: 'Scope',
        desc: 'The picker in the page header cleans up this workspace, other workspaces, removed ones or all of them.',
      },
      {
        term: NAMES.branches,
        desc: 'Workspace, Branches starts with After merge: Ask first, Delete on this Mac or Also on origin, and a branch with later commits is left alone. Then the branches safe to delete, and Recently deleted restores one.',
      },
      {
        term: 'Other tools',
        desc: 'The Claude Code, Codex and Cursor folders on this Mac, read only, with how much came from Goodboy sessions.',
      },
      {
        term: 'Security findings',
        desc: 'The last section of Storage. Saving a script checks it for keys and tokens on your Mac; Not a secret dismisses a finding, and Flag again brings it back.',
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
        label: `Open ${NAMES.branches}`,
        target: {
          kind: 'studio',
          studio: { kind: 'settings', focus: { scope: 'workspace', section: 'branches' } },
        },
      },
    ],
  },
  {
    id: 'settings',
    group: 'housekeeping',
    title: 'Settings and backup',
    lead: 'App settings apply everywhere and workspace settings to one workspace. Your whole setup can move to another Mac.',
    points: [
      {
        term: 'Settings rail',
        desc: `Settings, or ⌘,, opens on the page you used last. The rail groups App, Workspace, ${NAMES.providersAndModels} and Integrations, and the last two fold. Search settings finds any setting, and a dot marks a page that needs you.`,
      },
      {
        term: 'Copy and restore',
        desc: 'Copy from another workspace, or Restore defaults, previews every change before it applies. A field that differs from its default has a dot and a Reset.',
      },
      {
        term: 'App pages',
        desc: `General, Updates, ${NAMES.keyboardShortcuts}, Storage, ${NAMES.backupAndReset} and ${NAMES.iphone}, where ${NAMES.pairIphone} shows the code the phone scans.`,
      },
      {
        term: 'Open with',
        desc: 'In General, pick the editor worktrees open in and the browser for links and artifacts.',
      },
      {
        term: 'Export and import',
        desc: `${NAMES.backupAndReset} exports in groups such as workspaces and workflows, and Never included lists what stays behind, keys first. Import shows what it adds before writing and never deletes.`,
      },
      {
        term: 'Backup before a data update',
        desc: 'Before an update changes your data, Goodboy makes a full copy and keeps the last two. An older Goodboy on newer data offers Restore backup or Quit.',
      },
    ],
    links: [
      {
        label: 'Open Settings',
        target: { kind: 'studio', studio: { kind: 'settings', focus: { scope: 'home' } } },
      },
      {
        label: `Open ${NAMES.backupAndReset}`,
        target: {
          kind: 'studio',
          studio: { kind: 'settings', focus: { scope: 'app', section: 'backup' } },
        },
      },
    ],
  },
  {
    id: 'updates',
    group: 'housekeeping',
    title: 'Updates',
    lead: "Updates download in the background, and What's new shows what changed.",
    points: [
      {
        term: 'Update ready',
        desc: 'The version pill in the Goodboy row opens the update card: Update now downloads, then Restart now installs. With agents running, Restart when they finish waits for them. A failed update offers Retry.',
      },
      {
        term: 'Check for Updates',
        desc: 'In the Goodboy menu of the macOS menu bar, or Check for updates on Settings, App, Updates, it looks for an update now.',
      },
      {
        term: NAMES.whatsNew,
        desc: 'Searchable release notes. After an update, one page covers the releases you skipped, and a release that changes your data in one direction carries a mark.',
      },
      {
        term: 'Report a bug',
        desc: 'The bug icon at the foot of the sidebar, or ⌘I, opens Report a bug from any screen, and What gets sent shows exactly what leaves.',
      },
    ],
    links: [
      { label: "Open What's new", target: { kind: 'studio', studio: { kind: 'changelog' } } },
    ],
  },
  {
    id: 'keyboard',
    group: 'housekeeping',
    title: 'Keyboard shortcuts',
    lead: 'Most of Goodboy works from the keyboard. One list drives the keys, the shortcut page, the menu bar and the tooltips.',
    points: [
      {
        term: 'Command palette',
        desc: 'Opens on what you look at: in a session, Next steps first, then its actions. A few letters find sessions, agents, plans, pages, scripts and actions, and any text can go to Ask in chat.',
      },
      {
        term: 'Search',
        desc: 'Finds sessions, messages, agents, plans, decisions, issues, pull requests and branches, by type, folder or provider, and in a focused terminal its scrollback.',
      },
      {
        term: 'Menu bar',
        desc: 'The macOS menu bar holds the Goodboy menu, then File, Edit, View, Go, Window and Help, each item with the key the app uses.',
      },
      {
        term: 'Sidebar, rail and panes',
        desc: '⌘B folds the sidebar, ⌥⌘B the page column. ⌘[ steps the rail out or goes Back, and ⌘↑ goes up. In a session, ⌘L opens Ask, ⌘⌥T Terminal, ⌘⌥X Explore, ⌘⌥C Context, ⌘⌥L Agents and ⌘⌥S Scripts.',
      },
      {
        term: 'Terminal',
        desc: 'Control and backtick open Terminal, every terminal of the workspace in one list. ⌘T adds a tab while one has focus, and shells survive a reload.',
      },
      {
        term: 'Right click',
        desc: 'Any session, agent, run, artifact, pull request, worktree row, file or message opens a menu with every action it has. Shift+F10 opens it on the focused row.',
      },
      {
        term: 'Composer keys',
        desc: 'In a message, Enter sends and ⇧Enter adds a line; in a document, ⌘Enter saves. Esc closes the menu, panel or dialog in front, never macOS full screen.',
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
    group: 'reference',
    title: 'How Goodboy listens',
    lead: 'The same few rules hold on every screen. This page reads the same constants the app does, so it cannot fall behind.',
    points: [],
    links: [],
    extra: 'listens',
  },
  {
    id: 'tokens',
    group: 'reference',
    title: 'Tokens and cost',
    lead: "Every message, yours and the agent's, is turned into tokens before billing. One token is about three quarters of an English word.",
    points: [
      {
        term: 'Input tokens',
        desc: 'Everything sent into the model: instructions, history, tool results and your latest message. It grows every turn, which is why later turns cost more.',
      },
      {
        term: 'Cached input tokens',
        desc: 'Parts of the prompt the provider reuses from a recent call, billed at a fraction of the input rate.',
      },
      {
        term: 'Output tokens',
        desc: 'What the model writes back, text plus tool calls.',
      },
      {
        term: 'Context window',
        desc: 'The most one call can hold. The context meter in each turn footer shows how full it is.',
      },
    ],
    links: [],
  },
  {
    id: 'tips',
    group: 'reference',
    title: 'Tips',
    lead: 'Habits that pay off across sessions.',
    points: [
      {
        term: 'Triage the board by lane',
        desc: 'Start with needs you, then in review, and let the running ones run.',
      },
      {
        term: 'One short goal per session',
        desc: 'Long open-ended sessions drift. When the scope grows, or the context is nearly full, start a new one.',
      },
      {
        term: 'Light models for looking around',
        desc: 'A light model can search, list and summarize at a fraction of the price.',
      },
    ],
    links: [],
  },
  {
    id: 'legend',
    group: 'reference',
    title: 'Legend',
    lead: 'What the colors and marks mean across the app.',
    points: [],
    links: [],
    extra: 'legend',
  },
];
