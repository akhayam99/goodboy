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
    id: 'words',
    group: 'start',
    title: 'Words',
    concept: 'help',
    lead: 'The words Goodboy uses, one sentence each.',
    points: [
      {
        term: 'Workspace',
        desc: 'Where you work, named after what you work on. It holds your projects, your connected tools and every session.',
      },
      {
        term: 'Project',
        desc: 'One repository or folder inside a workspace, with its own scripts and settings.',
      },
      {
        term: 'Session',
        desc: 'One task with one goal. It has its own agents, budget and notes, and moves across the board until it is done.',
      },
      {
        term: 'Agent',
        desc: 'One chat inside a session, with its own provider and model. A session always has at least one.',
      },
      {
        term: 'Turn',
        desc: 'One message from you and the answer that follows. Every turn adds to what the model has to read, so later turns cost more.',
      },
      {
        term: 'Run',
        desc: 'A workflow in motion. Each step of a run gets its own agent.',
      },
      {
        term: 'Worktree and branch',
        desc: 'A separate copy of a project on its own branch, so a session never touches your main checkout. Goodboy makes one when the work needs it, in a folder named gb- and six characters.',
      },
      {
        term: 'Plan',
        desc: 'What an agent proposes before it writes code. You approve it, change it or discard it.',
      },
      {
        term: 'Budget',
        desc: 'A limit you set on a session or a provider. Goodboy warns you as the spend nears it.',
      },
    ],
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
        desc: 'Tell agents once who you are and how you like to work. Settings shows which role reads each part. Topics under Explain more when it touches collect what agents explained about them, in Explanations.',
      },
      {
        term: 'Pinned scripts',
        desc: 'Pin a script per project from Scripts, in the session tools, or from the card of the project on Projects. It holds across worktrees and shows under $ in the palette. A project with nothing pinned shows Suggested scripts with a Pin on each.',
      },
      {
        term: 'Repositories',
        desc: 'Repositories, beside the workspace switcher in the top bar, says which repos have something to pull, such as 3 behind or Diverged. Goodboy fetches every 5 minutes without moving a local branch. Pull updates one repo, Pull all every repo that can fast-forward, and Settings, General, Repositories sets how often it checks.',
      },
      {
        term: 'Monitoring',
        desc: 'Monitoring, the pulse icon in the top bar, says which ports are taken and by whom: a worktree, a main checkout, or a script, terminal or agent Goodboy started. Pinned holds the ports you add with Pin a port, each with an optional description, and starts empty; Run by Goodboy, From workspace and Listening on this Mac follow, and a port shows in one of them only. Pin or Hide a row from its menu. Stop acts on a row, Force stop follows if the process stays, and Leftovers lists what an earlier run left behind.',
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
        desc: "Usage, the models in your picker, permissions and your account, in one place. Providers billed per token say so instead of showing usage windows. A check that times out says Can't check and keeps what Goodboy last knew, and a sign-in that no check has confirmed shows apart from one that has. Test connection on Claude, Codex and Cursor makes a real account call and shows how long it took, and History lists the last 20 changes.",
      },
      {
        term: 'Auto in Models',
        desc: 'This is the model setting, not the Auto agent. Auto runs each role on the newest model of its line, Sonnet 5.5 on Claude today, and Models shows what it picks now. Open a role to see how it runs, and give it up to three models for Auto to pick from. A model you turn off in Models in the picker is left out of Auto and the workflow orchestrator.',
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
    lead: 'A session is one task: a goal, the agents working on it, and a branch for each project they edit. It starts as a draft and becomes a session only when you press Start or Start blank. Esc closes the draft page, and with text in it asks whether to keep the draft or discard it.',
    points: [
      {
        term: 'Four ways to start',
        desc: 'One selector at the top of the page holds Pick up a task, Run a workflow, Orchestrate and Ask an agent, and a line under it says what the choice does. Discard, in the actions row, throws the draft away.',
      },
      {
        term: 'Pick up a task',
        desc: 'Choose an issue from your tools or Tasks. Goodboy drafts a short title and goal linked back to it, and you edit them in the same block. Then choose how to work on it: Run a workflow, Orchestrate or Ask an agent, and press Start from the issue. A Sentry error or a GitHub or GitLab item opens in its project and says why. A GitHub pull request link gives Review pull request.',
      },
      {
        term: 'Several issues',
        desc: 'Pick up to five issues in Tasks and start one session from them. The first names the branch, the brief is written from all of them, and every issue links to the session. A session started blank offers Write on its Overview to draft a title and goal from the issues linked to it.',
      },
      {
        term: 'Run a workflow',
        desc: 'Several agents work through your goal, step by step. Describe the steps or pick a saved workflow, see and edit the plan, set Autonomy, Starts and Limit, then Start run creates the session and starts the run.',
      },
      {
        term: 'Orchestrate',
        desc: 'Give a goal and the orchestrator picks each next step until the goal is done. Start orchestration creates the session and starts the run. See Agents, roles and workflows for how it differs from Auto.',
      },
      {
        term: 'Ask an agent',
        desc: 'One agent in the role you pick. Scout is the default and maps an unfamiliar repo before you plan. To let Auto pick the roles, use Start Auto in the session New menu, with a limit.',
      },
      {
        term: 'Projects',
        desc: 'Projects is optional. The picker lists Suggested projects first, then All projects, and you can pick several or none: with none, Goodboy adds a project when an agent needs it. When you pick more than one, Ask an agent shows a chip naming the project the agent works in.',
      },
      {
        term: 'Chat',
        desc: 'Chat, a door in the sidebar that reopens your last chat, answers a question about the whole workspace without a session. It only reads, on Claude or Codex, with the model and effort you pick for each chat. Make default in the picker saves them for new chats in the workspace. Start work from chat drafts a brief, and Start session opens a new session with it, nothing running yet, or Add to a session leaves it in the message box of one you pick. Paste, drop or attach up to 10 images to a message, and Claude or Codex reads them. Each chat row shows its model. Pin and archive a chat from its menu, delete it from its row or header, or select several and archive or delete them together.',
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
        desc: 'The title, the project and one signal: an open question, a failed check, the pull request in its state color, or the agents at work. Rest the pointer on a card for its age, issues, agents and cost. One suggested action and the card menu sit at its right.',
      },
      {
        term: 'Board and List',
        desc: 'The Sessions page header switches between the lanes and one list with aligned columns: key, title, project, signal and last update. The filter beside it sorts, groups and narrows both, and a repo pill shows only while a repository needs you.',
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
        term: 'Now chip',
        desc: 'The top bar counts sessions that need you and running ones, from any screen.',
      },
      {
        term: 'Top bar',
        desc: 'Now, Limits, Spend and the bell sit on the right, with +N for providers past the first few. Impact opens from Spend, and a button switches between light and dark. Settings, App, General keeps the choice of following your system. Monitoring, the pulse icon, shows the ports in use and says Pinned port down when a pinned one drops.',
      },
    ],
    links: [{ label: 'Go to the board', target: { kind: 'board' } }],
    extra: 'stages',
  },
  {
    id: 'shell',
    group: 'task',
    title: 'Sidebar, session rail and panes',
    concept: 'workspace',
    lead: 'Three places hold everything you move through. The sidebar stays on the workspace, the session rail drills inside one session, and the session tools open panes beside the page.',
    points: [
      {
        term: 'Sidebar',
        desc: 'New session comes first, then the doors Sessions, Tasks, Chat, Workflows and Terminal. A + on Chat and on Terminal starts a new chat or terminal, a number counts what runs, and a dot says a chat has a new reply. Pinned and Sessions follow, then Settings, the Goodboy row and the Report a bug button. The Goodboy row opens a menu with the Guide. The sidebar never changes level: it looks the same on every screen, and in a session it only marks the open session row.',
      },
      {
        term: 'Hide the sidebar',
        desc: 'The button at the top, or ⌘B, folds the sidebar into icons, and Show sidebar brings it back. ⌘B folds only the sidebar and leaves the session rail as it is.',
      },
      {
        term: 'Session rows',
        desc: 'One line each: a mark and the title. The mark is red only when something broke, amber when you must answer, approve or act, green when the pull request is ready to merge, a teal ring while it waits in the merge queue, and a filled violet check when the session is done. Rest on a row for its card. The filter button in the Sessions header filters by status or project, shows archived, sorts and groups, and a line under the list says how many sessions it hides, with Clear. A session with no activity for three days moves to the Inactive group at the bottom, newest first, and its row says how long, such as inactive 5d. A pinned session, the open one, one you opened in the last day, one with work running, queued or waiting on you, an unread reply or a draft in its message box never moves there, and opening or touching an inactive session brings it straight back up. Control Tab flips between recent sessions, and Option Command Down jumps to the next one that needs you.',
      },
      {
        term: 'Pin a session',
        desc: "Pin session, in a row's right-click menu or the palette, moves a session to a Pinned group at the top of the list, in the order you pinned them, whatever the sort or filter. Move up and Move down change the order, and Unpin session puts it back. When the sidebar is folded to icons, pinned sessions stay on the rail, with a flyout for the rest.",
      },
      {
        term: 'Session rail',
        desc: "Click a session and the session rail opens at the left of the page, beside the sidebar. Its top row holds the fold button, then Pin, pressed while it is on, and Refresh. Then come its pages with their counts: Overview, Runs, Orchestrated, Agents, Auto agents with an Experimental chip, Artifacts and Questions. A dot beside a count says something runs, and a warning dot says a question waits. The Projects card is a tree: click a project to fold its branches, and the arrow before a branch to fold its Pull request, Comments, Files with the lines added and removed, and Checks, one click from the session. Each branch starts with its pull request icon in its color, gray for a draft, green when open, amber in the merge queue, violet when merged and red when closed, then its number and one dot for its worst state. A branch that needs you starts open, and the rail remembers what you open. The Linked card lists the work linked to the session. Each card folds from its title and has a + to add. The foot shows what the session spent, against its limit when it has one, and opens the spend and limit; Archive and Delete sit under it; rename the session from its Overview title or its row in the sidebar. Drag the rail's edge to resize it.",
      },
      {
        term: 'Levels',
        desc: "A branch, a run or Auto steps the rail one level in, and the level slides in without moving the sidebar. On a branch the rail reads ‹ and the session's name, the project and branch, a status line while a git step is due, then Pull request, Comments, Files, Commits and Checks. On a run it reads ‹ Runs, the run title, Overview and every step in order. On Auto it reads ‹ and the session's name, Auto, then each agent it started with its state, and Limit with what is left at the foot. The back row, or ⌘[ while focus is in the rail, steps out. The session level has no back row, because the sidebar is the way to another place.",
      },
      {
        term: 'Fold the rail',
        desc: 'Fold session rail, the button at the top of the rail, shrinks it to the icons of the current level, and Show session rail brings it back. ⌥⌘B folds it too, and folds the inner column of any other page, such as the chat list. It keeps its own setting, apart from the sidebar. In a narrow window the sidebar folds first and then the rail, so the page keeps room to work; open one by hand and it stays open until the window grows.',
      },
      {
        term: 'Session tools',
        desc: 'A thin column of icons at the right of the session page, before any open panel, holds Ask, Terminal, Explore, Context and Scripts, and they stay the same while the rail steps into a branch, a run or Auto, folded or not. Hover an icon to read its name and key. A tool opens as a pane beside the page, one at a time: press its icon again, or Esc, to close it, and another icon replaces it; the open one shows pressed. A dot on Context says the context is updating or changed since you last looked, and a red dot says it could not update. Page headers keep only the actions of the page and one ⋯. Outside a session, the Terminal and Chat doors of the sidebar take their place.',
      },
      {
        term: 'Ask',
        desc: 'Ask, or ⌘L, opens a panel that reads the session: what needs you now, and answers with buttons for what you can do. Nothing runs in one click. Its header button, or ⌘N inside the panel, starts a new chat and keeps the old one under Earlier.',
      },
      {
        term: 'Terminal, Explore and Scripts',
        desc: 'Terminal opens in the worktree of the session, and the picker named Terminal folder in its header, the project then the branch, switches the folder; ⌘N opens it. Explore browses the files of the session, and a file opens in place with Back to files. Scripts lists the scripts of the project, and an output opens in place with Back to scripts.',
      },
    ],
    links: [],
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
        desc: 'Scout, Plan, Implement, Debug, Test, Review, Docs, Resolve and Generalist. A role sets the instructions, the default model and what the agent hands back. Resolve answers review comments from the Comments section and is never a workflow step: a step that needs a fix uses Implement.',
      },
      {
        term: 'Talking to an agent',
        desc: 'Enter queues your message for its next turn, and ⌘Enter interrupts and sends it now. Stop waits until the process has exited and keeps what it wrote, then offers Continue; if the agent cannot be stopped it stays running with the error shown, and a second press tries again. A queued message stays saved until the provider accepts it. After a restart or an update, agents that were working stay Stopped. Use Resume on one agent, Resume all in overview Next steps, or Resume all above a run.',
      },
      {
        term: 'Activity',
        desc: 'Activity has two views, Activity and Log. Activity shows one row per launch: a run, an agent, or a fix run with its comments. It reads newest first, and a run has a lane in its own colour. Each row starts with its role as an icon, never a word, and ends with the model that ran and its effort (N models on a run past two), the duration and the cost. Runs shows its steps the same way. Rest the pointer on an icon or a model to see its card in either place, or press I on a row. A finished run or step folds into a count row such as 4 subagents; click it or press Right to open it. Needs you sits on top with what waits for you. Log holds the facts, such as links, branches and decisions. The Runs tab lists the runs of a session.',
      },
      {
        term: 'New menu',
        desc: 'New in the Overview header opens a menu: Run a workflow, Orchestrate, Ask an agent, Start Auto, Write a report and Draw a wireframe. Each opens its form in a pane beside the page. Run a workflow and Orchestrate take a goal with Autonomy, Starts and Limit. Ask an agent starts one role with a goal, a role and a model. Write a report and Draw a wireframe draft a document. The button is filled when nothing is running, blocked or waiting on a question and Next has nothing to offer.',
      },
      {
        term: 'Overview',
        desc: 'The Overview is titled with the session name: one click renames it in place, Enter saves and Esc cancels, up to 120 characters. It reads top to bottom: the goal, then anything a worktree needs you to decide (a closed worktree with Reopen, a failed action with Retry, a stopped rebase, a branch that moved), then Needs you, Next and Activity. Projects and linked work live in the session rail.',
      },
      {
        term: 'Next steps',
        desc: 'Next offers up to three moves that unblock the task as short buttons such as Start, Analyze or Push; the first one is filled. When it starts an agent, the icon is that role in its color. Other ways to do it sit in the more menu. Once a pull request merges, Next offers Remove the worktree with the reason and its size. Not now says Dismissed with Undo, and ⌘Z brings the last one back.',
      },
      {
        term: 'Run page',
        desc: 'Opening a run with a fixed list of steps moves the session rail into it: back to Runs, the run title, Overview, every step in order with its sub-agents, Add step, and the limit with what it spent at the foot. The center shows the step you pick as its conversation, and the line at its end says what the run waits for with the one button that moves it on, such as Start step 3, Review plan or Raise limit. The time on a step and on that line counts only the time agents worked, never a wait for you. Pause run, then Resume run in its place, and Stop run sit in the run header, and Autonomy and Skip step in the run menu. An orchestrated run does not step the rail in: it stays on Orchestrated as one page.',
      },
      {
        term: 'Agent suggests',
        desc: 'When an agent recommends another role, its transcript shows Agent suggests with the reason. Pick the provider, model and effort, then press Start. The new agent begins with that reason and what the previous agent wrote.',
      },
      {
        term: 'Workflows',
        desc: 'Start from Refactor, Plan and ship or Fix a bug, or build your own. Each step follows its role or pins a model, and its menu holds Duplicate, Save as step, Move and Delete, with Undo. Restore built-in workflows, a button next to New workflow that shows when a built-in was deleted or changed, brings it back. Deleting a run deletes its agents and their open questions.',
      },
      {
        term: 'Run defaults',
        desc: 'The Run defaults tab in Workflows sets what new runs start with: autonomy, a limit, which providers get the next step and guidance. Use providers with room left sends steps to the provider with room. A run keeps the copy of the rules it started with.',
      },
      {
        term: 'Orchestrated',
        desc: 'Give a goal and an orchestrator model picks each next step with a reason, until it says done or blocked. Orchestrated is its own page in the session rail, after Runs: the goal, one checklist of the steps and what is left, a line that says what the orchestrator does now and why, and a box that reads Hint the orchestrator. Queue holds a hint for the next decision, and Send now makes the orchestrator read it at once: its tooltip says Read now stops the step in flight, keeps what it wrote, and decides again. Waiting hints sit under one line, Waits for the next decision, and one being read says Reading now.',
      },
      {
        term: 'Auto',
        desc: 'Auto is an experimental agent that is always available. Start Auto in the session New menu starts it: it answers what it can, hands the rest to child agents of the roles it picks, waits for their results and goes on, all under a limit. Its agents live under Auto agents in the session rail, where each shows its state and the foot says Limit and what is left. You can write to Auto at any time, and Move to Auto hands it an agent you started yourself. When Auto cannot decide its next step it reads Blocked with the reason and Retry, and Stop and Retry work from every window.',
      },
      {
        term: 'Orchestrated or Auto',
        desc: 'Orchestrated is not Auto. Orchestrated runs a workflow: the orchestrator only decides the next step, each step gets its own agent, and you steer with hints. Auto is one agent you talk to, which delegates work to children on its own under a limit. Each has its own entry in the session rail, and only Auto carries the Experimental chip.',
      },
      {
        term: 'Pause and resume',
        desc: 'Pause lets the step in flight finish and starts nothing new. Resume picks up where the run was, Skip step cancels the step that is running, and Stop run ends it now. Pause run and Stop run sit as buttons in the run header while the run lives; once paused, Resume run takes the place of Pause run, and Stop run asks first. A step quiet for 15 minutes offers Ask it to continue.',
      },
      {
        term: 'Autonomy',
        desc: 'Ask me, Balanced or Autopilot. Balanced waits once, on the plan: Review plan opens it in a drawer, and Approve runs the rest without you. A guard stops an agent after 4 unattended turns in an hour.',
      },
      {
        term: 'Open questions',
        desc: 'Each question is one card: pick an answer with its number and press Enter, or write something else. The Questions page lists them under Needs you and Answered, a row opens its card in a drawer, and the same card sits in the transcript. A blocking question holds its step until you answer or choose Send as message, and Let an agent decide hands it to another agent.',
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
        desc: 'Each decision gets a number and a byline. A decision Goodboy records keeps why it was made. Click one in the Context pane to open it and edit or remove it. A removal takes effect at once and can be undone while the pane stays open.',
      },
      {
        term: 'Running summary',
        desc: 'After each turn, State, Next and Learned are updated for the next agent, and an edit you made is kept.',
      },
      {
        term: 'Context pane',
        desc: 'Open Context from the session tools, or with ⌘⌥C, to see the goal, decisions and summary, and Copy context. A dot on Context means something changed since you last looked, and those changes come first, with Mark as read on the Decisions list. Context updates, at the top, shows the last update with its model and cost, and Update now queues one. Explanations lists what agents explained about your topics, for you only, with Dismiss and Undo.',
      },
      {
        term: 'Visible to',
        desc: 'The eye on each card of the pane says which roles receive it. Reviewers, debuggers and resolvers also read the decisions.',
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
        desc: 'Issues, pull requests, threads and errors from your connected tools in one list. It opens on For me: what is assigned to you, starred or linked to your sessions. Groups by source, status or project show five rows each and Show all. Paste a code like HBL-412 or a link to open any issue. One Filter menu in the header narrows by source, what to show, type and project. A row opens in the pane on the right, and Open full shows it at full width.',
      },
      {
        term: 'Start from anything',
        desc: 'Start from an issue, a Slack thread or an error, with the brief already drafted, or Review pull request on one waiting for you. Link to a session attaches the item to one you already have, and + Add next to Linked in the session rail, or L, searches your trackers from there. Link a task to the session and pick whether merging closes it, or press Star it on a tracker issue to keep it in Tasks, Starred.',
      },
      {
        term: 'Task links',
        desc: 'A Linked row in the session rail opens the task. Its right click menu holds Move to, Take off this branch and Unlink from session, which act at once and show an Undo toast, and ⌘Z undoes the last one when focus is not in a text field. The Log keeps the event with Re-link. Drag a Linked row onto a worktree row of the session rail to move it there (Alt copies), or use Link work to this branch in the worktree menu.',
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
        desc: 'One page per branch. Click a worktree under Projects and the session rail steps into it: the project, the branch with a chevron that switches branches or starts a new one, a menu of the worktree actions, a status line with Rebase while the branch is behind, then Pull request, Comments, Files, Commits and Checks with their counts, only the ones that make sense: with no pull request it shows Pull request, Files and Commits, and Comments once a note exists. Every section sits on one centred column. It opens the same way from the palette, a notification, a chat card or the board. The back row at the top of the session rail returns to the session, and Back walks your history.',
      },
      {
        term: 'Pull request',
        desc: 'The pull request on its own entry, on GitHub, GitLab (Merge request) and Bitbucket. Its properties come first, grouped as state (state, base, checks and whether it can merge, in words), people (author, reviewers) and links (the issues it closes). Rename it with E and edit the description in place, read its activity, add reviewers, mark it ready, close it or merge it with the methods the host allows. A pull request held for a merge reads Queued, with Cancel auto-merge in its menu. A branch with no pull request offers a create form here, with Write with Scribe, the base branch, Draft or Ready, reviewers and the issues it closes.',
      },
      {
        term: 'Comments',
        desc: "The review threads of the branch and your own notes in one full list, each with a chip, Note or On GitHub. A row opens the comment in a drawer with the code around the line, its thread, and Fix, Reply and Skip with their keys F, R and S; J and K move to the next or previous comment. Each comment is Working, Needs you, Ready, Couldn't fix or Done, and the list groups by those words with Needs you on top. Fix comments, in the Branch header, opens a drawer beside the page with every open comment grouped by file. Start fix runs one agent through the ones you check, in its own copy of the branch, and Analyze only leaves its changes as proposals. Each comment ends in Fix proposed, Question, No change or Failed, and Apply 3 fixes, Post 2 replies, Retry and Accept 5 act on many at once, with Undo.",
      },
      {
        term: 'Fix run',
        desc: "A fix run is one agent in one copy of the branch. A line under the tabs says what it is doing and counts the comments by word, each a filter. The agent asks only when a comment reads two ways, and the question shows in the comment's thread and in its transcript. Open fix run opens a drawer beside Comments with two tabs: Fix, with the comments the run covers and its commits, and Transcript, the whole conversation. It opens on Transcript while the run works, and on Fix once it ended or asks a question.",
      },
      {
        term: 'Files',
        desc: 'The changed files as a tree in a list on the right of the code, which you widen by dragging its edge or fold away (Files in the toolbar brings it back), with Next unviewed at its top. The code reads as one diff in the order of the tree, with a ring on each folder that fills as you mark files Viewed, and a filter with All, Unviewed and Commented in one menu. Display holds Unified, Split and Wrap long lines. Show more lines opens the context around a change, up to the whole file, and a double click on a name shows where it is defined and used. Comment on a line or on a whole file with Comment on file, or quote a line into a note or a question for an agent. J and K move between files, V marks one viewed, F jumps into the tree and / filters. Write review, in the header of the pull request, takes line comments, the verdict and a summary, sent with Approve, Request changes or Submit comments.',
      },
      {
        term: 'Notes',
        desc: 'Add note on a line saves it with the project and branch you are on, and it sits under its line. It shows in Comments with the chip Note, Fix comments counts it, and Post to GitHub moves it into your review draft. A note an agent works on cannot be closed or deleted. Notes without a branch wait in Unassigned notes on the Session overview, where each has Move to and Discard, and Discard all clears the list with Undo.',
      },
      {
        term: 'Review sources',
        desc: 'Each comment carries a label with its host, GitHub, GitLab or Bitbucket, and your own notes carry the label Note. Bitbucket cannot resolve a thread, so its comments offer Reply.',
      },
      {
        term: 'What git says',
        desc: 'A comment reads Already on origin or Looks fixed when the branch already holds its fix, and Fix went missing when the commit is gone. Re-check asks a read-only agent whether the fix is still needed.',
      },
      {
        term: 'Checks',
        desc: 'The CI runs of a pull request, or the jobs of the latest GitLab pipeline, grouped as Failing, Running, Passed and Skipped, with the failing step. Checks, reviewers and review requests are read apart, so a check that cannot be read says why and names the fix, and Merge says Checks unknown. Analyze on a failing check starts the Debugger, which reads the log and proposes a fix; the row then opens its drawer and reads a short state such as Fix proposed, Not pushed or Re-running. Start fix and Push live in the Debugger drawer; after Push the check runs again and the drawer says if it passed or still fails. Whether it can merge reads in plain words, a blocked Merge says why beside it, and Merge and Close confirm under the header.',
      },
      {
        term: 'Push',
        desc: 'One Push in the Branch header, always for every ready comment. When nothing needs a decision it pushes on that click. Otherwise an inline preview lists the commits and one Push sends the fixes, posts the replies and resolves the threads where the provider allows it. Add a hint, on every start of a fix, passes your words to the agent.',
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
        term: 'Commits',
        desc: 'The Commits section of the Branch page shapes the history, and at rest it is one column: the branch as it is, with a base row that says how far it is behind and holds Rebase onto latest. Drag a commit to move it or onto another to fold it in, or reword, squash or drop it from the row. Each edit applies to the branch at once, with Undo and Redo in the header. A conflict stops the edit and leaves the branch as it was.',
      },
      {
        term: 'A rebase is one job',
        desc: 'One banner under the Branch header tells the rebase, on every section. When it would touch files you have not committed, Stash and rebase sets them aside and brings them back, and if that conflicts they stay in a stash and the banner says so. A stopped rewrite offers Retry with a note.',
      },
      {
        term: 'Conflicts stop an edit',
        desc: 'A history edit that would conflict changes nothing. The row names the error and offers Rewrite with an agent.',
      },
      {
        term: 'Push and restore',
        desc: "Apply and update online replaces the online branch only when nothing newer is there, so it never overwrites a teammate's work. Every rewrite saves a version, and Previous versions lists them with Reset branch to go back to one.",
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
        desc: 'In the planner chat and its Brief a plan is one row. Press it to read the plan in a drawer, where one button moves it on, Approve or Run plan, and Edit changes it by hand. Approve moves the run on, and one toast offers Follow the run. Open in Artifacts and Copy markdown sit in its header, and you drag its edge to resize it. While the planner reworks it, the drawer says Revising to v2 and the button is off.',
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
        desc: 'Artifact lists group under plain labels, Needs you, Ready, Running, Consumed (plans that ran, and replaced versions) and Recently deleted, every row in view except Recently deleted, which opens with Show, and New marks one from the last day you have not opened. Delete has Undo, and Recently deleted restores.',
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
        desc: 'Settings opens on the page you opened last, or General the first time, and takes over the sidebar with Back to app and Search settings on top, open or folded. The rail lists App, Workspace, Providers & models and Integrations, and a dot marks a page that needs you. Every page is also in the palette. Drag the edge of a rail to resize it.',
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
        term: 'Update card',
        desc: "When an update is ready, the chip in the Goodboy row opens a card beside it with Restart now, Later and What's new. Later snoozes it.",
      },
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
        term: 'Terminal',
        desc: 'Control and the backtick key open Terminal, with every terminal of the workspace and its sessions in one list. A new terminal opens in the workspace folder, chips open one in a worktree or the main checkout, and the shells and their output are still there after a reload. ⌘T adds a terminal while one has focus. From a session, Terminal in the pane buttons opens one beside the page and it stays in the list. Terminals are grouped by session, one row per worktree, each with its terminals as tabs and a port chip for a port it listens on. The tabs come back after a restart.',
      },
      {
        term: 'Search',
        desc: 'Finds sessions, messages, agents, plans, decisions, questions, issues, pull requests, branches, workflows and diff comments, filtered by type, project, provider, status or date. Walk the matches in a view with ⌘G. In a focused terminal it finds in the scrollback.',
      },
      {
        term: 'Sidebar, rail and panes',
        desc: '⌘B hides or shows the sidebar and nothing else. ⌘[ steps the session rail out one level while focus is in it, and anywhere else it is Back. In a session, ⌘L opens Ask, ⌘⌥T Terminal, ⌘⌥X Explore, ⌘⌥C Context and ⌘⌥S Scripts.',
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
