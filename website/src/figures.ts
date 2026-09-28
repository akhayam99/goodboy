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

const FRAME_WIDTHS = [1144, 2288, 3432] as const;
const PHONE_WIDTHS = [732, 1098, 1464] as const;

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

const frame = ({ id, height = 2145, alt }: FrameParams): FrameFigure => ({
  source: { id, widths: FRAME_WIDTHS, width: 3432, height },
  phone: { id: `${id}-phone`, widths: PHONE_WIDTHS, width: 1464, height: 1830 },
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
  source: {
    id,
    widths: [displayWidth, displayWidth * 2, displayWidth * 3],
    width: displayWidth * 3,
    height,
  },
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
  height: 1430,
  alt: 'The Harborline board: sessions in Building, Running, Needs you and In review, each card with its pull request and its cost',
});

export const SWITCH_BELL = fragment({
  id: 'switch-bell',
  height: 1092,
  displayWidth: 520,
  isClosed: true,
  alt: 'The notification bell with four unread rows and Open all notifications',
});

export const FIND_SEARCH = fragment({
  id: 'find-search',
  height: 1390,
  displayWidth: 656,
  alt: 'Search inside the webhook session: the field, five filters and the top three results',
});

export const WORKSPACE_PROJECTS = fragment({
  id: 'workspace-projects',
  height: 1092,
  displayWidth: 780,
  alt: 'The projects of the webhook session: payments-api with pull requests 318 and 311, notify-relay with pull request 57',
});

export const DEV_DIFF = fragment({
  id: 'dev-diff',
  height: 1833,
  displayWidth: 754,
  cap: 320,
  alt: 'One hunk of applyWebhook.ts in the diff, where the fix passes the event id along',
});

export const DEV_HISTORY = frame({
  id: 'dev-history',
  alt: 'Rewrite history on payments-api hl/fix-duplicate-credit: a backup to restore, the branch as it is now with two fixups folding into their commits, and the three commits it becomes after Apply',
});

export const RUN_CANVAS = frame({
  id: 'run-canvas',
  height: 1841,
  alt: 'The step graph of the duplicate credit fix run: the orchestrator waiting on step 1, three scouts working at the same time with one done, and the plan, two implementers and the tester still to come',
});

export const IMPACT = frame({
  id: 'impact',
  alt: 'Impact for the last 7 days: Claude spend against its monthly cap with the cap ring at 42 percent, spent, cap and remaining',
});

export const INBOX_ISSUE = fragment({
  id: 'inbox-issue',
  height: 1311,
  displayWidth: 541,
  alt: 'Issue HBL-412 open in the Inbox, with its fields, Launch session and Link to a session',
});

export const ARTIFACTS_COMPARE = fragment({
  id: 'artifacts-compare',
  height: 1240,
  displayWidth: 416,
  alt: 'Version 3 of the deliveries wireframe, with the stuck delivery banner above the deliveries table',
});

export const CONTEXT_CHANGES = fragment({
  id: 'context-changes',
  height: 1717,
  displayWidth: 510,
  isClosed: true,
  alt: 'The Decisions tab of the Context panel: four changes since you last looked, one decision added, one replaced, one withdrawn and one reworded, above the five active decisions',
});

export const STORAGE_LOCAL = fragment({
  id: 'storage-local',
  height: 1064,
  displayWidth: 686,
  alt: 'The storage summary: 5.1 GB used, 5.0 GB that can go, and the usage bar with its legend',
});

export const WORKSPACE_CHAT = fragment({
  id: 'workspace-chat',
  height: 1292,
  displayWidth: 666,
  alt: 'An answer about Harborline: where the consent step lives in payments-api, a table of three files and what each does, Read 4 files, Copy and Start work from here',
});

export const CHAT_PLAIN = fragment({
  id: 'chat-plain',
  height: 603,
  displayWidth: 591,
  alt: 'One exchange in a plain chat: the first message, its plan, the operations and the reply',
});
