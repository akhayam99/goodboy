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
  alt: 'A Harborline session: the sessions list on the left, the webhook fix with its projects, pull requests 318 and 57, an open question and the Activity timeline with each agent and its model',
  details: [
    {
      id: 'session-d1',
      width: 902,
      height: 816,
      caption: 'Every task is a session, sorted by where it stands',
    },
    {
      id: 'session-d2',
      width: 1738,
      height: 730,
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
      width: 2054,
      height: 739,
      caption: 'Eight chats on one task, each with a role and its own model',
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
      width: 768,
      height: 298,
      caption: 'Where it stands, its pull request, its cost',
    },
    {
      id: 'board-d2',
      width: 1150,
      height: 464,
      caption: 'Claude spend this month against its cap',
    },
  ],
};

export const BUILDER: Figure = {
  id: 'builder',
  width: 2572,
  height: 1707,
  alt: 'A new orchestrated workflow for the duplicate credit fix, with its goal, the orchestrator on GPT-5.6 Sol and guidance to stop before any change to ledger-core',
  details: [
    {
      id: 'builder-d1',
      width: 1229,
      height: 672,
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
      width: 1066,
      height: 835,
      caption: 'HBL-412, one press away from a session',
    },
    {
      id: 'inbox-d2',
      width: 672,
      height: 394,
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
      width: 1707,
      height: 747,
      caption: 'A drafted reply with Accept, Reply and Skip',
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
      width: 1479,
      height: 749,
      caption: 'v3 adds a stuck-delivery banner and an attempts column',
    },
    {
      id: 'compare-d2',
      width: 2016,
      height: 1229,
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
      width: 1066,
      height: 1171,
      caption: 'Decision 3 replaced decision 1, and says why',
    },
    {
      id: 'context-d2',
      width: 2477,
      height: 864,
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
      width: 1901,
      height: 537,
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
      width: 1853,
      height: 614,
      caption: 'What each working copy weighs, and which are safe to remove',
    },
  ],
};
