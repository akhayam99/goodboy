import type { Source } from './components/Picture';

export type FrameFigure = {
  readonly source: Source;
  readonly phone: Source;
  readonly alt: string;
};

export type FragmentFigure = {
  readonly source: Source;
  readonly displayWidth: number;
  readonly cap?: number;
  readonly alt: string;
};

const WIDTHS = [1200, 2400, 3840] as const;

type FrameParams = {
  readonly id: string;
  readonly height?: number;
  readonly alt: string;
};

type FragmentParams = {
  readonly id: string;
  readonly height: number;
  readonly displayWidth: number;
  readonly cap?: number;
  readonly alt: string;
};

const frame = ({ id, height = 2400, alt }: FrameParams): FrameFigure => ({
  source: { id, widths: WIDTHS, width: 3840, height },
  phone: { id: `${id}-phone`, widths: WIDTHS, width: 3840, height: 4800 },
  alt,
});

const fragment = ({ id, height, displayWidth, cap, alt }: FragmentParams): FragmentFigure => ({
  source: { id, widths: WIDTHS, width: 3840, height },
  displayWidth,
  cap,
  alt,
});

export const HERO_SESSION = frame({
  id: 'hero-session',
  alt: 'The overview of a Harborline session: tasks by stage on the left, the webhook fix with its projects, branches and pull requests 318, 311 and 57, and the first rows of its activity',
});

export const RUN_AGENTS = frame({
  id: 'run-agents',
  alt: 'A workflow run on the duplicate credit fix: the run header, the orchestrator and the agents by role, each with its model and cost',
});

export const BOARD = frame({
  id: 'board',
  height: 1599,
  alt: 'The Harborline board: sessions in Building, Running, Needs you and In review, each card with its pull request and its cost',
});

export const SWITCH_BELL = fragment({
  id: 'switch-bell',
  height: 2688,
  displayWidth: 520,
  alt: 'The notification bell with four unread rows and Open all notifications',
});

export const FIND_SEARCH = fragment({
  id: 'find-search',
  height: 2712,
  displayWidth: 656,
  alt: 'Search inside the webhook session: the field, five filters and the top three results',
});

export const WORKSPACE_PROJECTS = fragment({
  id: 'workspace-projects',
  height: 1792,
  displayWidth: 780,
  alt: 'The projects of the webhook session: payments-api with pull requests 318 and 311, notify-relay with pull request 57',
});

export const DEV_PR = fragment({
  id: 'dev-pr',
  height: 1450,
  displayWidth: 754,
  alt: 'The header of payments-api pull request 318: in review, 9 comments to resolve, 47 lines added and 12 removed',
});

export const DEV_DIFF = fragment({
  id: 'dev-diff',
  height: 3112,
  displayWidth: 754,
  cap: 320,
  alt: 'One hunk of applyWebhook.ts in the diff, where the fix passes the event id along',
});

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

export const CHAT: Figure = {
  id: 'chat',
  width: 3840,
  height: 2400,
  alt: 'An implementer chat on Codex: the ask, three groups of operations, both pull requests up and a Slack reply for #payments-oncall waiting to be sent',
  details: [],
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
