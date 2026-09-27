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
  readonly focus: number;
  readonly details: readonly Detail[];
};

export const SESSION: Figure = {
  id: 'session',
  width: 3840,
  height: 2400,
  alt: 'A Harborline session: the sessions list on the left, the webhook fix with its projects, pull requests 318 and 57, an open question and the Activity timeline with each agent and its model',
  focus: 0.62,
  details: [
    {
      id: 'session-d1',
      width: 902,
      height: 816,
      caption: 'Every task is a session, sorted by where it stands',
    },
    {
      id: 'session-d2',
      width: 1400,
      height: 588,
      caption: 'Each step names its agent, its model and its cost',
    },
  ],
};

export const AGENTS: Figure = {
  id: 'agents',
  width: 3840,
  height: 2400,
  alt: 'A workflow run on the webhook fix: eight agents, scouts on Composer, GPT-5.6 Terra and Haiku, a planner on Opus 5.5, implementers on GPT-5.6 Sol and Kimi K3 and a tester on Haiku, each with its own cost',
  focus: 0.5,
  details: [
    {
      id: 'agents-d1',
      width: 1400,
      height: 504,
      caption: 'Eight chats on one task, each with a role and its own model',
    },
  ],
};

export const CHAT: Figure = {
  id: 'chat',
  width: 3840,
  height: 2400,
  alt: 'An implementer chat on Codex: the ask, three groups of operations, both pull requests up and a Slack reply for #payments-oncall waiting to be sent',
  focus: 0.45,
  details: [],
};

export const BOARD: Figure = {
  id: 'board',
  width: 3840,
  height: 1600,
  alt: 'The Harborline board: eleven sessions across building, running, needs you and in review, each card with its pull request and its cost',
  focus: 0.5,
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
  focus: 0.3,
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
  focus: 1,
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
  alt: 'Seven review comments on pull request 318 grouped by file, one fixed in commit 4f21c8b, one waiting for an answer and several replies ready to review',
  focus: 0.35,
  details: [
    {
      id: 'resolve-d1',
      width: 1400,
      height: 565,
      caption: 'A fix committed, and replies drafted for you to review',
    },
  ],
};

export const COMPARE: Figure = {
  id: 'compare',
  width: 3840,
  height: 2400,
  alt: 'Wireframe compare for the deliveries screen, v2 to v3, where v3 adds a stuck delivery banner and an attempts column',
  focus: 0.9,
  details: [
    {
      id: 'compare-d1',
      width: 1400,
      height: 709,
      caption: 'v3 adds a stuck-delivery banner and an attempts column',
    },
    {
      id: 'compare-d2',
      width: 1400,
      height: 853,
      caption: 'The session report, as a document',
    },
  ],
};

export const CONTEXT: Figure = {
  id: 'context',
  width: 3840,
  height: 2400,
  alt: 'The brief an implementer received on Codex, next to the Context drawer where decision 3 replaced decision 1 with its reason',
  focus: 1,
  details: [
    {
      id: 'context-d1',
      width: 1066,
      height: 1171,
      caption: 'Decision 3 replaced decision 1, and says why',
    },
    {
      id: 'context-d2',
      width: 1400,
      height: 488,
      caption: 'The brief the agent received, part by part',
    },
  ],
};

export const IMPACT: Figure = {
  id: 'impact',
  width: 3840,
  height: 2400,
  alt: 'Claude spend for the last 30 days: $151.72 of a $170 cap, a warning at 80 percent, and the spend by model',
  focus: 0.3,
  details: [
    {
      id: 'impact-d1',
      width: 1400,
      height: 395,
      caption: 'What is left of the Codex plan, with a free reset',
    },
  ],
};

export const STORAGE: Figure = {
  id: 'storage',
  width: 3840,
  height: 2400,
  alt: 'Storage settings: working copies of old sessions with what each weighs, 5.0 GB in all, and one button to remove the three that are safe',
  focus: 0.55,
  details: [
    {
      id: 'storage-d1',
      width: 1400,
      height: 464,
      caption: 'What each working copy weighs, and which are safe to remove',
    },
  ],
};

export type PhoneImage = {
  readonly id: string;
  readonly width: number;
  readonly height: number;
};

export type PhoneShot = {
  readonly alt: string;
  readonly caption: string;
  readonly images: readonly PhoneImage[];
};

export const PHONE_CHAT: PhoneShot = {
  alt: 'An implementer chat on Codex: the fix is in, both pull requests are up, and a Slack reply for #payments-oncall waits for Send',
  caption: 'One chat, one job: it made the fix and drafted the reply',
  images: [{ id: 'chat-p', width: 1080, height: 1530 }],
};

export const PHONE_BOARD: PhoneShot = {
  alt: 'Two board columns: needs you, with two sessions waiting on a question, and in review, with pull requests 318 and 90 and what each cost',
  caption: 'Needs you and in review, with each pull request and its cost',
  images: [
    { id: 'board-p1', width: 791, height: 716 },
    { id: 'board-p2', width: 791, height: 716 },
  ],
};

export const PHONE_BUILDER: PhoneShot = {
  alt: 'A new orchestrated workflow: the orchestrator on GPT-5.6 Sol, guidance to stop before any change to ledger-core, and Start workflow',
  caption: 'An orchestrator picks each next agent, on the model you set',
  images: [{ id: 'builder-p', width: 1080, height: 1533 }],
};

export const PHONE_INBOX: PhoneShot = {
  alt: 'HBL-412 open in the Inbox: urgent, assigned to Dana R., with Launch session and the description from Linear',
  caption: 'HBL-412, one press away from a session',
  images: [{ id: 'inbox-p', width: 1080, height: 1642 }],
};

export const PHONE_REPORT: PhoneShot = {
  alt: 'The session report: Retried webhooks no longer double credit, with what was wrong and where it came from',
  caption: 'The session report, as a document you can share',
  images: [{ id: 'report-p', width: 1080, height: 1631 }],
};

export const PHONE_CONTEXT: PhoneShot = {
  alt: 'The Context drawer: two active decisions, and decision 1 replaced by decision 3 with its reason',
  caption: 'Decision 3 replaced decision 1, and says why',
  images: [{ id: 'context-d1', width: 1066, height: 1171 }],
};
