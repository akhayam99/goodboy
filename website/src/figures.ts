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
  readonly isClosed?: boolean;
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
  readonly isClosed?: boolean;
  readonly alt: string;
};

const frame = ({ id, height = 2400, alt }: FrameParams): FrameFigure => ({
  source: { id, widths: WIDTHS, width: 3840, height },
  phone: { id: `${id}-phone`, widths: WIDTHS, width: 3840, height: 4800 },
  alt,
});

const fragment = ({
  id,
  height,
  displayWidth,
  cap,
  isClosed = false,
  alt,
}: FragmentParams): FragmentFigure => ({
  source: { id, widths: WIDTHS, width: 3840, height },
  displayWidth,
  cap,
  isClosed,
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
  isClosed: true,
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

export const BUILDER = frame({
  id: 'builder',
  alt: 'The workflow builder for the duplicate credit fix: its goal, Orchestrated mode, the plan, the orchestrator on GPT-5.6 Sol and guidance to ask before any change to ledger-core',
});

export const IMPACT = frame({
  id: 'impact',
  alt: 'Impact for the last 7 days: Claude spend against its monthly cap with the cap ring at 42 percent, spent, cap and remaining',
});

export const INBOX_ISSUE = fragment({
  id: 'inbox-issue',
  height: 3102,
  displayWidth: 541,
  alt: 'Issue HBL-412 open in the Inbox, with its fields, Launch session and Link to a session',
});

export const REVIEW_REPLY = fragment({
  id: 'review-reply',
  height: 1737,
  displayWidth: 546,
  alt: 'A review comment from kenji-w on config.ts and the reply drafted for it',
});

export const ARTIFACTS_COMPARE = fragment({
  id: 'artifacts-compare',
  height: 3816,
  displayWidth: 416,
  alt: 'Version 3 of the deliveries wireframe, with the stuck delivery banner above the deliveries table',
});

export const CONTEXT_DECISIONS = fragment({
  id: 'context-decisions',
  height: 4071,
  displayWidth: 540,
  isClosed: true,
  alt: 'The Decisions tab of the Context panel: two active decisions and one replaced, with its reason',
});

export const STORAGE_LOCAL = fragment({
  id: 'storage-local',
  height: 1986,
  displayWidth: 686,
  alt: 'The storage summary: 5.1 GB used, 5.0 GB that can go, and the usage bar with its legend',
});

export const CHAT_PLAIN = fragment({
  id: 'chat-plain',
  height: 1306,
  displayWidth: 591,
  alt: 'One exchange in a plain chat: the first message, its plan, the operations and the reply',
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
