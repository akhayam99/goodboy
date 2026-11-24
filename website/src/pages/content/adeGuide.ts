import { SITE } from '../../lib/site';

export type AdeCompareRow = {
  readonly label: string;
  readonly ide: string;
  readonly terminal: string;
  readonly ade: string;
};

export type AdeLink = {
  readonly label: string;
  readonly href: string;
};

export type AdeJob = {
  readonly id: string;
  readonly title: string;
  readonly need: string;
  readonly how: string;
  readonly links: readonly AdeLink[];
};

export type AdeQuestion = {
  readonly question: string;
  readonly answer: string;
};

export const ADE_GUIDE = {
  title: 'What is an agentic development environment (ADE)?',
  definition:
    'An agentic development environment (ADE) is where you run several coding agents at once and stay in charge of the work. Each agent works on its own branch in an isolated copy of the code, shares context with the others and hands you a diff to review before anything merges. An IDE helps you write code, and an ADE helps you direct the agents that write it.',
  compare: {
    heading: 'ADE, IDE and terminal agents',
    intro: 'Each row is a question to put to any tool that calls itself an ADE.',
    columns: ['IDE with an assistant', 'Terminal agent', 'ADE'],
    rows: [
      {
        label: 'Who drives the work',
        ide: 'You write the code and the assistant suggests or edits beside you',
        terminal: 'You prompt one agent and follow it as it works',
        ade: 'You set goals, agents do the work and you decide what ships',
      },
      {
        label: 'How many agents at once',
        ide: 'One assistant in the open editor window',
        terminal: 'One agent for each terminal',
        ade: 'Several, one session for each goal',
      },
      {
        label: 'Where each agent works',
        ide: 'In your open checkout',
        terminal: 'In the folder you started it in',
        ade: 'In a git worktree for each branch, or one at a time in a folder without git',
      },
      {
        label: 'How context carries between agents',
        ide: 'It stays in that editor chat',
        terminal: 'It stays in that terminal session',
        ade: 'The environment keeps the goal, decisions and summary and hands them on',
      },
      {
        label: 'How you review',
        ide: 'In the editor, as changes land',
        terminal: 'In git, after the agent stops',
        ade: 'In the environment, branch by branch, before merge',
      },
    ],
  },
  jobs: {
    heading: 'What an ADE has to do',
    intro: 'An ADE earns the name by doing six jobs. Each one is below, with how Goodboy does it.',
    items: [
      {
        id: 'parallel-sessions',
        title: 'Run agents in parallel',
        need: 'Several goals move at once, and you can see where each one stands.',
        how: 'Goodboy starts one session for each goal and shows them all on the board, in five lanes from Building to Archived. Each session moves to the lane that matches what is happening in it, and the ones that wait on you sit as cards above the lanes.',
        links: [{ label: 'The stage board', href: `${SITE.doc('board')}#stage-board` }],
      },
      {
        id: 'isolation',
        title: 'Isolate each task',
        need: 'Agents never edit the same files at the same time.',
        how: 'In a git repository, each branch an agent works on gets its own git worktree, so agents edit in parallel without touching your checkout. A folder without commits is edited in place by one session at a time, and the next one waits. One session can work across several repositories.',
        links: [{ label: 'Worktrees', href: `${SITE.doc('workspace')}#worktrees` }],
      },
      {
        id: 'shared-context',
        title: 'Share context and decisions',
        need: 'The next agent should not need the story told again.',
        how: 'The goal, decisions and a running summary travel with the session. Record a decision once and the planners, implementers, reviewers, debuggers and resolvers after it read it, within a size limit that keeps the newest decisions. Scouts, docs agents and agents the Lead starts read only their brief.',
        links: [{ label: 'Decisions', href: `${SITE.doc('context')}#decisions` }],
      },
      {
        id: 'review',
        title: 'Review before merge',
        need: 'Agent output reaches your main branch only after you have read it.',
        how: 'The Branch page holds a pull request, its comments, changed files, commits and checks. Check review comments and press Fix: an agent turns them into commits, and nothing leaves your machine until you push.',
        links: [{ label: 'Resolve review comments', href: `${SITE.doc('review')}#resolve` }],
      },
      {
        id: 'spend',
        title: 'Control spend',
        need: 'Cost stays visible and capped while agents run.',
        how: 'Cap what a run or a session can spend, and Goodboy pauses workflows or only warns, as you choose. A monthly cap per provider warns you before you reach it.',
        links: [
          { label: 'Run limits', href: `${SITE.doc('workflows')}#limit` },
          {
            label: 'Monthly caps',
            href: `${SITE.doc('providers')}#monthly-cap-and-budget-alert`,
          },
        ],
      },
      {
        id: 'your-agents',
        title: 'Work with the agents you already use',
        need: 'Switching environments should not mean switching agents.',
        how: 'Goodboy runs the coding agents already on your computer. You sign in to each from the app and keep the plans you already pay for.',
        links: [{ label: 'Providers', href: SITE.doc('providers') }],
      },
    ],
  },
  faq: {
    heading: 'Common questions',
    items: [
      {
        question: 'Is an ADE the same as an IDE?',
        answer:
          'No. An IDE is built around you editing files, and an ADE around agents doing the editing while you direct and review. The two work side by side.',
      },
      {
        question: 'Do I need to replace my editor?',
        answer:
          'No. Goodboy works on your own repositories and opens the code in your own editor, so your editor stays where it is.',
      },
      {
        question: 'Which coding agents work with Goodboy?',
        answer: 'Claude Code, Codex, Cursor, Gemini and Copilot, all in one session.',
      },
      {
        question: 'Is Goodboy free?',
        answer:
          'Yes. Goodboy is free to download and needs no account. Its source is available on GitHub under FSL-1.1-MIT.',
      },
      {
        question: 'Does an ADE run locally?',
        answer:
          'Goodboy does. It is a desktop app for macOS and Linux, and your tasks, decisions and settings stay on your computer. Prompts go to the provider you chose.',
      },
    ],
  },
  cta: {
    heading: 'Try Goodboy on a real task',
    lead: 'Install it, sign in to an agent you already use and start a session from an issue or a sentence.',
  },
} as const satisfies {
  readonly title: string;
  readonly definition: string;
  readonly compare: {
    readonly heading: string;
    readonly intro: string;
    readonly columns: readonly string[];
    readonly rows: readonly AdeCompareRow[];
  };
  readonly jobs: {
    readonly heading: string;
    readonly intro: string;
    readonly items: readonly AdeJob[];
  };
  readonly faq: {
    readonly heading: string;
    readonly items: readonly AdeQuestion[];
  };
  readonly cta: {
    readonly heading: string;
    readonly lead: string;
  };
};
