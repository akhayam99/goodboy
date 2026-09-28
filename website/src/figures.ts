import type { Source } from './components/Picture';

export type FrameFigure = {
  readonly source: Source;
  readonly phone: Source;
  readonly alt: string;
};

export type FragmentFigure = {
  readonly source: Source;
  readonly displayWidth: number;
  readonly alt: string;
};

export type Detail = {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly caption: string;
};

export type Figure = {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly details: readonly Detail[];
};

export const SESSION: Figure = {
  id: 'session',
  width: 3840,
  height: 2400,
  alt: 'A Harborline session: the activity bar with every task by stage on the left, the webhook fix with its projects, pull requests 318 and 57, an open question and the Activity timeline with each agent and its model',
  details: [
    {
      id: 'session-d1',
      width: 1380,
      height: 1312,
      caption: 'Every task sorted by where it stands, and what it waits on',
    },
    {
      id: 'session-d2',
      width: 3880,
      height: 1500,
      caption: 'Each step names its agent, its model and its cost',
    },
  ],
};

export const AGENTS: Figure = {
  id: 'agents',
  width: 3840,
  height: 2400,
  alt: 'A workflow run on the webhook fix: eight agents, scouts on Composer, GPT-5.6 Terra and Haiku, a planner on Opus 5.5, implementers on GPT-5.6 Sol and Kimi K3 and a tester on Haiku, each with its own cost',
  details: [
    {
      id: 'agents-d1',
      width: 3940,
      height: 1248,
      caption: 'Eight chats on one task, each with a role and its own model',
    },
  ],
};

export const SWITCH: Figure = {
  id: 'switch',
  width: 3840,
  height: 2400,
  alt: 'The notifications page: a pull request opened, a session at 80 percent of its cap, a handoff to retry and a folder left on disk, filtered by severity, source and workspace',
  details: [
    {
      id: 'switch-d1',
      width: 1540,
      height: 984,
      caption: 'The bell keeps the latest, unread first',
    },
  ],
};

export const FIND: Figure = {
  id: 'find',
  width: 3840,
  height: 2400,
  alt: 'Search for credit inside the webhook session: a message, a plan, the session, an issue and pull request 318, with the actions of the picked result on the right',
  details: [
    {
      id: 'find-d1',
      width: 3280,
      height: 2000,
      caption: '⌘K on an agent: its actions first, then every place to go',
    },
  ],
};

export const WORKSPACE: Figure = {
  id: 'workspace',
  width: 3840,
  height: 2400,
  alt: 'The Harborline workspace settings with its three projects, ledger-core, notify-relay and payments-api, and what agents know about you',
  details: [
    {
      id: 'workspace-d1',
      width: 3228,
      height: 1044,
      caption: 'One task, a branch and a pull request in each repo it touches',
    },
  ],
};

export const DEVELOPERS: Figure = {
  id: 'developers',
  width: 3840,
  height: 2400,
  alt: 'Rewrite history on a payments-api branch: the branch as it is now, with a fold, a combine, a removal, a move and a rename, next to the four commits it becomes after Apply',
  details: [
    {
      id: 'developers-d1',
      width: 2600,
      height: 1380,
      caption: 'The pull request page, with Review and Diff one click away',
    },
    {
      id: 'developers-d2',
      width: 2560,
      height: 1560,
      caption: 'The diff, with a note left on a line',
    },
    {
      id: 'developers-d3',
      width: 3800,
      height: 1760,
      caption: 'Branches Goodboy made, and which are safe to delete',
    },
  ],
};

export const CHAT: Figure = {
  id: 'chat',
  width: 3840,
  height: 2400,
  alt: 'An implementer chat on Codex: the ask, three groups of operations, both pull requests up and a Slack reply for #payments-oncall waiting to be sent',
  details: [],
};

export const BOARD: Figure = {
  id: 'board',
  width: 3840,
  height: 1600,
  alt: 'The Harborline board: eleven sessions across building, running, needs you and in review, each card with its pull request and its cost',
  details: [
    {
      id: 'board-d1',
      width: 1152,
      height: 448,
      caption: 'Where it stands, its pull request, its cost',
    },
    {
      id: 'board-d2',
      width: 3844,
      height: 1400,
      caption: 'Claude spend this month against its cap',
    },
  ],
};

export const BUILDER: Figure = {
  id: 'builder',
  width: 3840,
  height: 2508,
  alt: 'A new orchestrated workflow for the duplicate credit fix, with its goal, the orchestrator on GPT-5.6 Sol and guidance to ask before any change to ledger-core',
  details: [
    {
      id: 'builder-d1',
      width: 2740,
      height: 1460,
      caption: 'Orchestrated, custom or preset, with an orchestrator on the model you set',
    },
  ],
};

export const INBOX: Figure = {
  id: 'inbox',
  width: 3840,
  height: 2400,
  alt: 'The Inbox with HBL-412 pasted in the search and open on the right, with Launch session',
  details: [
    {
      id: 'inbox-d1',
      width: 1600,
      height: 1296,
      caption: 'HBL-412, one press away from a session',
    },
    {
      id: 'inbox-d2',
      width: 1000,
      height: 640,
      caption: 'GitHub, Linear, Sentry and Slack in one list',
    },
  ],
};

export const RESOLVE: Figure = {
  id: 'resolve',
  width: 3840,
  height: 2400,
  alt: 'Review for pull request 318: comments grouped as open, waiting for the push and done, one reply open on the right, and Push 1 in the header',
  details: [
    {
      id: 'resolve-d1',
      width: 2520,
      height: 1160,
      caption: 'A drafted reply with Redraft, Accept, Reply and Skip',
    },
  ],
};

export const COMPARE: Figure = {
  id: 'compare',
  width: 3840,
  height: 2400,
  alt: 'Wireframe compare for the deliveries screen, v2 to v3, where v3 adds a stuck delivery banner and an attempts column',
  details: [
    {
      id: 'compare-d1',
      width: 2260,
      height: 1280,
      caption: 'v3 adds a stuck-delivery banner and an attempts column',
    },
    {
      id: 'compare-d2',
      width: 3400,
      height: 1960,
      caption: 'The session report, as a document',
    },
  ],
};

export const CONTEXT: Figure = {
  id: 'context',
  width: 3840,
  height: 2400,
  alt: 'The brief an implementer received on Codex, next to the Context drawer where decision 3 replaced decision 1 with its reason',
  details: [
    {
      id: 'context-d1',
      width: 1608,
      height: 1900,
      caption: 'Decision 3 replaced decision 1, and says why',
    },
    {
      id: 'context-d2',
      width: 3760,
      height: 1320,
      caption: 'The brief the agent received, part by part',
    },
  ],
};

export const IMPACT: Figure = {
  id: 'impact',
  width: 3840,
  height: 2400,
  alt: 'Claude spend for the last 30 days: $151.72 of a $170 cap, a warning at 80 percent, and the spend by model',
  details: [
    {
      id: 'impact-d1',
      width: 3860,
      height: 1280,
      caption: 'What is left of the Codex plan, with a free reset',
    },
  ],
};

export const STORAGE: Figure = {
  id: 'storage',
  width: 3840,
  height: 2400,
  alt: 'Storage settings: working copies of old sessions with what each weighs, 5.0 GB in all, and one button to remove the three that are safe',
  details: [
    {
      id: 'storage-d1',
      width: 3840,
      height: 1328,
      caption: 'What each working copy weighs, and which are safe to remove',
    },
  ],
};

export const SUPPORT: Figure = {
  id: 'support',
  width: 3840,
  height: 2400,
  alt: 'Report a bug open over the Harborline board: one line typed, the version, system, screen and CLI versions as chips, and Send',
  details: [
    {
      id: 'support-d1',
      width: 2256,
      height: 888,
      caption: 'One line, and what gets sent is shown before it goes',
    },
  ],
};
