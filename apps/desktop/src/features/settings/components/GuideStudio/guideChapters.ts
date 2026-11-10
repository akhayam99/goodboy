import type { GuideLink } from './guideTarget';
import { START_CHAPTERS } from './startChapters';
import { NAMES } from '../../../../shared/utils/names';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';

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
  ...START_CHAPTERS,
  {
    id: 'folders',
    group: 'daily',
    title: 'Workspaces and projects',
    lead: 'A workspace holds what you work on: projects, git repositories or plain folders, and one session can work across several of them.',
    points: [
      {
        term: 'One window per workspace',
        desc: 'Open each workspace in its own window, so switching never stops a running agent; while agents run, the switcher offers a new window. After a reload or an update, every window comes back.',
      },
      {
        term: 'Add a project',
        desc: `${NAMES.addProject}, in the workspace switcher or on Settings, Workspace, ${NAMES.projects}, adds a repository or a plain folder. A star and a one line description on a project go into every agent brief.`,
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
        label: `Open ${NAMES.projects}`,
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
        desc: 'Picking a folder asks what it is for. Change it later in Settings, Projects.',
      },
      {
        term: 'One writer at a time',
        desc: 'One session writes in a folder at a time. The next waits its turn.',
      },
      {
        term: 'Changes',
        desc: "The session rail lists each reply's files. Restore a file or a whole reply, then Undo restore if you change your mind.",
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
        label: `Open ${NAMES.projects}`,
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
        desc: `${NAMES.providers}, in Settings, has a page per provider with usage, the models in your picker, permissions and your account. Test connection makes a real account call.`,
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
        desc: 'When Codex offers a free reset, its page shows the expiry and Use reset,.',
      },
      {
        term: NAMES.spendCap,
        desc: "A session's limit sits on the spend at the foot of its rail. A provider's Monthly limit, with Warn at for the warning, sits in Impact, Spend.",
      },
    ],
    links: [
      {
        label: `Open ${NAMES.providers}`,
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
    lead: 'A session starts from one goal: write it or pick one from Tasks, then pick the kind of run. It stays a draft until you press Start or Start blank.',
    points: [
      {
        term: 'What kind of run?',
        desc: 'How picks Auto, Agent, Orchestrated or Preset. One form shows only what that kind needs.',
      },
      {
        term: NAMES.startARun,
        desc: 'Press no kind and Auto picks a workflow or an agent; @Scout starts that role. Esc closes the draft, asking first if you wrote something.',
      },
      {
        term: 'Start from Tasks',
        desc: `${NAMES.startSession}, on an issue in Tasks, opens New session with the issue linked and its goal written in. Pick from Tasks does the same on the page.`,
      },
      {
        term: 'Pin folders',
        desc: 'The folders chip reads Auto picks: an agent adds the folder it must edit. Pin folders there from Suggested or All projects.',
      },
      {
        term: 'New menu',
        desc: "New, in a session's Overview header, opens Start a run on Runs, or Write a report and Draw a wireframe, each a form in a pane.",
      },
      {
        term: 'Start blank',
        desc: 'Opens the session on its Overview, to add the goal, folders and work later.',
      },
      {
        term: 'Chat',
        desc: 'A sidebar door that answers questions about the workspace and never changes a file. Start work from chat drafts a session from an answer.',
      },
    ],
    links: [{ label: 'Start a new session', target: { kind: 'newSession' } }],
  },
  {
    id: 'board',
    group: 'daily',
    title: 'Board',
    lead: 'The Board of the sidebar. Each session sits in a lane for what is happening in it, so you never move cards by hand.',
    points: [
      {
        term: 'Session card',
        desc: 'The title, the folder and one signal: an open question, a failed check, the pull request in its state color or the agents at work. Rest on it for age, issues and cost.',
      },
      {
        term: 'Board and sidebar list',
        desc: 'Lanes on the Board. The sidebar lists the same sessions, and its filter menu sorts, groups and narrows them.',
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
        desc: 'Counts running sessions and scripts from any screen, and a click lists them. Sessions that need you put an amber dot on Board in the sidebar.',
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
    title: 'Sidebar and session pages',
    lead: 'The sidebar looks the same on every screen. A session opens its rail beside it, and the right rail holds the tools.',
    points: [
      {
        term: 'Sidebar',
        desc: 'New session, then Board, Tasks, Workflows, Chat, Impact and Monitoring, your sessions, Settings, and the Goodboy line with the bug icon. An amber dot says sessions need you, or on Monitoring that a pinned port is down.',
      },
      {
        term: 'Session rows',
        desc: 'One line each, its mark amber when you must act and red when something broke. The funnel on Board holds Sort, Group, Filter and Show archived.',
      },
      {
        term: 'Pin a session',
        desc: "Pin session, in a row's right click menu, keeps it in a Pinned group on top, and Move up and Move down reorder it.",
      },
      {
        term: 'Session pages',
        desc: `Overview, Runs, Artifacts and Questions, with counts; Runs holds plans, presets, Auto and agents. Then the Projects card, one tree of folders and branches, and the Linked card. Hide session pages, or ${shortcutGlyphs('innerColumn.toggle')}, folds it to icons.`,
      },
      {
        term: 'Session actions and +',
        desc: 'The + on the Projects card adds or connects a folder. The + on a folder row starts a new branch. More session actions, next to Pin, holds Archive and Delete; folded, at the foot.',
      },
      {
        term: 'Agents panel',
        desc: `Agents, or ${shortcutGlyphs('session.spawned')}, shows the open run or Auto as a tree, else what is live. An agent opens beside it; j and k hop.`,
      },
      {
        term: 'Right rail',
        desc: 'Icons at the right of every screen. A session page adds Explore, Context, Ask, Agents and Scripts; Terminal and Browser sit at the foot and stay open as you move. Open as page grows them into a page, Dock puts them back.',
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
        desc: `Enter queues your message for the next turn, and ${shortcutGlyphs('composer.submit')} sends it now. Over an open permission ask it denies the ask. Stop names what it stops and offers Continue. A message that can't start reads Not delivered, with Retry.`,
      },
      {
        term: 'Runs page',
        desc: 'Every run, grouped by branch or by state. Each agent opens as one page with its brief and what came back.',
      },
      {
        term: 'Auto',
        desc: 'The agent behind Start a run. It answers what it can, hands the rest to child agents of the narrowest role that fits and goes on under a limit, listed under Runs. A returned child reads Idle.',
      },
      {
        term: 'Let Auto take it from here',
        desc: 'Hands Auto an older agent you started yourself; Detach from Auto takes it back. When Auto cannot decide, it reads Blocked with Retry.',
      },
      {
        term: 'Overview cards',
        desc: 'The Overview shows Needs you, Running, Next, Branches and Done, each with its count, and hides an empty card. Needs you holds runs, questions and fixes.',
      },
      {
        term: 'Next',
        desc: `Up to three moves that unblock the session, such as Start, Analyze or Push; what follows sits on that run's Running row. Not now hides one, and ${shortcutGlyphs('app.undo')} brings it back.`,
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
        desc: 'A run lists its steps, with Add step under them. The line at the end says what it waits for, with the button that moves it on. A halted step reads Needs you, with Open step N.',
      },
      {
        term: 'Orchestrated',
        desc: 'Give a goal and an orchestrator model picks each next step with a reason, until done or blocked. Hint the orchestrator queues a hint, and Send now reads it at once, stopping the step in flight.',
      },
      {
        term: 'Orchestrated or Auto',
        desc: 'Orchestrated is not Auto: the orchestrator only picks the next step and you steer with hints. Auto is one agent that delegates to children.',
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
        desc: `Context, in the session tools or ${shortcutGlyphs('lens.context')}, holds the goal, decisions, summary and explanations in one column, with Copy context. Changes carry a mark until Mark as read, and Update now queues an update.`,
      },
      {
        term: 'Visible to',
        desc: 'Who reads this, in the menu of each card, says which roles receive it. Planners, implementers, reviewers, debuggers and resolvers read the decisions.',
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
        desc: 'Paste a code like HBL-412 or a link in the search to open any issue.',
      },
      {
        term: 'Start from anything',
        desc: `${NAMES.startSession} on an issue or an error opens a draft with its brief, and Review pull request starts a read-only reviewer. Link to a session attaches an item to an existing one.`,
      },
      {
        term: 'Task links',
        desc: `A Linked row in the rail opens its task. Its right click menu holds Move to, Take off this branch and ${NAMES.removeLinkFromSession}, each with Undo; the Log keeps Re-link.`,
      },
      {
        term: 'Slack',
        desc: 'Pick the channels and what agents may do there. Replies default to Ask first and wait for your Send.',
      },
    ],
    links: [
      {
        label: `Open ${NAMES.tasks}`,
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
    lead: 'One page per branch, so you read the code, fix review comments and merge without leaving the app.',
    points: [
      {
        term: 'Branch page',
        desc: 'Click a branch on the Projects card and its page opens in place: Pull request, Comments, Changes, Commits, Checks and Work. Rebase sits on its row, and Running here opens Monitoring on the branch.',
      },
      {
        term: 'Pull request',
        desc: 'One merge box says whether it can merge, then what holds it, worst first. Add reviewers or merge the ways the host allows; with none yet, a create form offers Write with Scribe.',
      },
      {
        term: 'Work',
        desc: 'Runs, questions and artifacts of the branch, with a count of what waits for you.',
      },
      {
        term: 'Comments',
        desc: 'Review threads and your own notes in one list, grouped Needs you, Working and Done. A row opens a drawer with the code, the thread and Fix, Reply and Skip on F, R and S.',
      },
      {
        term: 'Fix comments',
        desc: 'In the Branch header, it runs one agent through the comments you check, in its own copy of the branch. Each ends in a fix, a reply or a question, and nothing leaves until Push, which previews first when something needs a decision.',
      },
      {
        term: 'Changes',
        desc: 'The diff, with the file list behind Files and Viewed N of M on top. Comment on a line or a file, then review with Approve, Request changes or Submit comments.',
      },
      {
        term: 'Checks',
        desc: 'CI runs grouped as Failing, Running, Passed and Skipped. Analyze on a failing one starts the Debugger, which proposes a fix, with Start fix and Push in its drawer.',
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
        desc: `Undo and Redo, or ${shortcutGlyphs('history.undo')} and ${shortcutGlyphs('history.redo')}, work while the page stays open. Every edit saves a backup first, and Previous versions lists them with Reset branch to this version.`,
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
        desc: 'A conflict leaves the branch as it was and asks: Resolve with Auto, Resolve in terminal or Keep branch as it was, with Add a hint. Auto resolves in the worktree and never pushes; Resolve in terminal starts the rebase there.',
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
    lead: 'Plans, reports and wireframes live next to the session instead of inside a chat, with who made each and what it was built from.',
    points: [
      {
        term: 'One list',
        desc: 'All, Plans, Reports and Wireframes filter one list grouped by branch, waiting work first. Each row shows its state and one action, such as Run plan or Approve. Used rows fold into a count.',
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
    lead: 'The ports in use, who opened them down to the session, run and branch, and how to stop them, on macOS and Linux.',
    points: [
      {
        term: 'Four groups',
        desc: 'Pinned holds ports you add with Pin a port, with your description. Run by Goodboy, From workspace and Listening on this Mac follow; a port shows in one only.',
      },
      {
        term: 'A pinned port down',
        desc: 'When a pinned port stops listening, Monitoring in the sidebar shows an amber dot. Rest on it to read which port.',
      },
      {
        term: 'Rows',
        desc: 'Resting on a row shows Stop and the ⋯ menu; a right click opens the same menu: Open in browser, Pin, Hide and Copy address.',
      },
      {
        term: 'Stop',
        desc: 'Asks first and names who loses the port. A process that does not exit offers Force stop; a refused stop keeps the row with its reason.',
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
        desc: `Settings, or ${shortcutGlyphs('settings.open')}, opens as a page beside the sidebar, on the page you used last. Its rail groups App, This workspace, ${NAMES.providers} and Integrations, and the last two fold. Search settings finds any setting, and a dot marks a page that needs you.`,
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
        desc: 'The version pill in the Goodboy line opens the update card: Update now downloads, then Restart now installs. With agents running, Restart when they finish waits for them. A failed update offers Retry.',
      },
      {
        term: 'Check for Updates',
        desc: 'In the Goodboy menu of the macOS menu bar, or Check for updates on Settings, App, Updates, it looks for an update now.',
      },
      {
        term: NAMES.whatsNew,
        desc: 'Release notes in the second tab of Help, beside the Guide. After an update, one page covers the releases you skipped, and a release that changes your data in one direction carries a mark.',
      },
      {
        term: 'Report a bug',
        desc: `The bug icon at the foot of the sidebar, or ${shortcutGlyphs('report.open')}, opens Report a bug from any screen, and What gets sent shows exactly what leaves.`,
      },
    ],
    links: [
      {
        label: `Open ${NAMES.whatsNew}`,
        target: { kind: 'studio', studio: { kind: 'changelog' } },
      },
    ],
  },
  {
    id: 'keyboard',
    group: 'housekeeping',
    title: 'Keyboard shortcuts',
    lead: 'Most of Goodboy works from the keyboard. One list drives the keys, the shortcut page, the menu bar and the tooltips.',
    points: [
      {
        term: 'Search or run',
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
        desc: `${shortcutGlyphs('column.toggle')} folds the sidebar, ${shortcutGlyphs('innerColumn.toggle')} the page column. ${shortcutGlyphs('nav.back')} steps the rail out or goes Back, and ${shortcutGlyphs('nav.up')} goes up. In a session, ${shortcutGlyphs('lens.explore')} opens Explore, ${shortcutGlyphs('lens.context')} Context, ${shortcutGlyphs('ask.open')} Ask, ${shortcutGlyphs('session.spawned')} Agents and ${shortcutGlyphs('lens.scripts')} Scripts. ${shortcutGlyphs('browser.address')} focuses the Browser address, ${shortcutGlyphs('slot.close')} closes the drawer.`,
      },
      {
        term: 'Terminal',
        desc: `Control and backtick, or ${shortcutGlyphs('session.terminal')}, show or hide the Terminal dock on any screen. ${shortcutGlyphs('terminal.newTab')} adds a tab while one has focus, and shells survive a reload. A zsh row shows its last command.`,
      },
      {
        term: 'Right click',
        desc: 'Any session, agent, run, artifact, pull request, worktree row, file or message opens a menu with every action it has. Shift+F10 opens it on the focused row.',
      },
      {
        term: 'Composer keys',
        desc: `In a message, ${shortcutGlyphs('composer.send')} sends and ${shortcutGlyphs('composer.newLine')} adds a line; in a document, ${shortcutGlyphs('composer.submit')} saves. ${shortcutGlyphs('overlay.close')} closes the menu, panel or dialog in front, never macOS full screen.`,
      },
    ],
    links: [
      { label: 'Open Search or run', target: { kind: 'palette' } },
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
        desc: 'Everything sent into the model: instructions, history, tool results and your latest message. It grows every turn.',
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
        desc: 'Open-ended sessions drift. When the scope grows, start a new one.',
      },
      {
        term: 'Light models for looking around',
        desc: 'A light model can search, list and summarize cheaply.',
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
