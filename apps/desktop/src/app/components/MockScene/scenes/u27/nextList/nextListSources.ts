import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type SessionEvent,
  type SessionEventId,
} from '@goodboy/types';
import { delegationReasonTextOf } from '../../../../../../features/auto/delegationReasonTextOf';
import type { AutoActionTarget } from '../../../../../../features/session/central/next/actionCardsOf';
import type { NeedsYouOwner } from '../../../../../../features/session/timeline/needsYou';
import {
  historyStopTitleOf,
  segmentsToText,
  sessionEventLabel,
} from '../../../../../../features/session/timeline/sessionEventPresentation';
import { historyStopDetailOf } from '../../../../../../features/history/historyStopDetailOf';
import type { SessionSuggestion } from '../../../../../../features/suggestions/types';
import { SESSION_ID } from '../../resolveSeed';
import { NEXT_LIST_MOUNTS, type NextListMount } from './nextListMounts';

const ROLLOUT_AUTO = brandId<AgentId>({ value: 'mock-next-auto-rollout' });
const PROFILE_AUTO = brandId<AgentId>({ value: 'mock-next-auto-profile' });

const STOPPED = delegationReasonTextOf({ reason: 'stopped' });
const TIMED_OUT = delegationReasonTextOf({ reason: 'deadline_passed' });
const BLOCKED_IN_ITALIAN =
  'Non riesco a chiudere: lo snapshot della home fallisce perché manca la fixture dei dati di esempio per la sezione statistiche.';

type ChildParams = {
  readonly id: string;
  readonly role: string;
  readonly kind: AutoActionTarget['kind'];
  readonly reason: string | null;
};

const childOf = ({ id, role, kind, reason }: ChildParams): AutoActionTarget => ({
  agentId: brandId<AgentId>({ value: id }),
  rootAgentId: ROLLOUT_AUTO,
  role,
  noun: 'Agent',
  kind,
  reason,
  reasonCode: null,
  mountId: null,
  plan: null,
  canRetry: true,
});

type ApproveParams = {
  readonly rootAgentId: AgentId;
};

const approveOf = ({ rootAgentId }: ApproveParams): AutoActionTarget => ({
  agentId: rootAgentId,
  rootAgentId,
  role: 'Auto',
  noun: 'Auto',
  kind: 'approve',
  reason: null,
  reasonCode: null,
  mountId: null,
  plan: null,
  canRetry: false,
});

const AUTO_TARGETS: ReadonlyArray<AutoActionTarget> = [
  childOf({
    id: '3f9c1a52-home-implementer',
    role: 'Build the hero and stats strip of hl/feat-center-home-page',
    kind: 'childBlocked',
    reason: BLOCKED_IN_ITALIAN,
  }),
  childOf({
    id: 'a17e04d9-home-implementer-first',
    role: 'Build the hero of hl/feat-center-home-page for PR #9995',
    kind: 'failed',
    reason: STOPPED,
  }),
  childOf({
    id: '6b02f7e1-home-tester',
    role: 'Test the hl/feat-center-home-page hero on PR #9995',
    kind: 'timedOut',
    reason: TIMED_OUT,
  }),
  childOf({
    id: 'd4c8a913-billing-reviewer-first',
    role: 'Review the invoice table on hl/feat-center-billing-page',
    kind: 'failed',
    reason: STOPPED,
  }),
  childOf({
    id: '0e5b6c27-billing-reviewer',
    role: 'Review the billing page PR #9993 after the fixes',
    kind: 'timedOut',
    reason: TIMED_OUT,
  }),
  childOf({
    id: '8a3d2f60-search-scout',
    role: 'Map the search filters used by hl/feat-center-search-page',
    kind: 'neverStarted',
    reason: null,
  }),
  childOf({
    id: 'c61f9b08-settings-implementer',
    role: 'Move the settings form of hl/feat-center-settings-page to tabs',
    kind: 'failed',
    reason: delegationReasonTextOf({ reason: 'declined' }),
  }),
  approveOf({ rootAgentId: ROLLOUT_AUTO }),
  approveOf({ rootAgentId: PROFILE_AUTO }),
];

type RebaseParams = {
  readonly mount: NextListMount;
  readonly minute: number;
};

const rebaseStoppedOf = ({ mount, minute }: RebaseParams): NeedsYouOwner => {
  const event: SessionEvent = {
    id: brandId<SessionEventId>({ value: `mock-next-rebase-${mount.page}` }),
    sessionId: SESSION_ID,
    kind: 'history_stopped',
    payload: {
      origin: 'rebase',
      branch: mount.branch,
      mountId: mount.mountId,
      reason: 'origin-moved',
    },
    createdAt: brandId<IsoDateTime>({ value: `2026-10-21T09:${minute}:00.000Z` }),
  };
  return {
    id: `mock-next-rebase-${mount.page}`,
    kind: 'rebase',
    text: segmentsToText({ segments: sessionEventLabel({ event }) }),
    where: null,
    at: event.createdAt,
    item: null,
    question: null,
    questionIds: [],
    prNumber: null,
    owed: null,
    mountId: null,
    stopLines: {
      title: historyStopTitleOf({ event }),
      detail: historyStopDetailOf({ payload: event.payload }),
    },
  };
};

const OWNERS: ReadonlyArray<NeedsYouOwner> = [
  rebaseStoppedOf({ mount: NEXT_LIST_MOUNTS.home, minute: 12 }),
  rebaseStoppedOf({ mount: NEXT_LIST_MOUNTS.billing, minute: 14 }),
  rebaseStoppedOf({ mount: NEXT_LIST_MOUNTS.profile, minute: 17 }),
];

const { home, billing, search, settings, profile, pricing, about, faq, careers, contact } =
  NEXT_LIST_MOUNTS;

const base = {
  sessionId: SESSION_ID,
} as const;

type PushParams = {
  readonly mount: NextListMount;
  readonly state: 'ahead' | 'not-pushed' | 'diverged';
  readonly title: string;
  readonly detail: string;
  readonly ahead: number;
  readonly behind: number;
};

const pushOf = ({ mount, state, title, detail, ahead, behind }: PushParams): SessionSuggestion => ({
  ...base,
  id: `push-branch:${mount.mountId}`,
  kind: 'push-branch',
  priority: 41,
  band: 2,
  title,
  detail,
  targetKey: `branch:${mount.mountId}`,
  fingerprint: `push-branch:${mount.mountId}:${state}`,
  payload: {
    mountId: mount.mountId,
    projectId: mount.projectId,
    projectName: 'harbor-portal',
    branch: mount.branch,
    worktreePath: mount.worktreePath,
    state,
    ahead,
    behind,
  },
});

const BEHIND: ReadonlyArray<Readonly<{ mount: NextListMount; behind: number }>> = [
  { mount: home, behind: 14 },
  { mount: billing, behind: 12 },
  { mount: profile, behind: 11 },
  { mount: search, behind: 9 },
  { mount: settings, behind: 7 },
  { mount: pricing, behind: 6 },
  { mount: about, behind: 4 },
  { mount: faq, behind: 2 },
];

const SUGGESTIONS: ReadonlyArray<SessionSuggestion> = [
  {
    ...base,
    id: `answer-questions:${SESSION_ID}`,
    kind: 'answer-questions',
    priority: 0,
    band: 0,
    title: 'Answer open questions',
    detail: '2 questions blocking progress',
    targetKey: null,
    fingerprint: 'answer-questions:mock-next:2',
    payload: { count: 2, firstQuestion: null, rootAgentId: null },
  },
  {
    ...base,
    id: `fix-checks:${home.mountId}`,
    kind: 'fix-checks',
    priority: 20,
    band: 1,
    title: 'Fix the failing lint check',
    detail: 'harbor-portal #9995',
    targetKey: `pr:${home.mountId}`,
    fingerprint: `fix-checks:${home.mountId}`,
    payload: { mountId: home.mountId, projectName: 'harbor-portal', prNumber: 9995 },
  },
  {
    ...base,
    id: `resolve-threads:${SESSION_ID}`,
    kind: 'resolve-threads',
    priority: 30,
    band: 1,
    title: 'Fix review conversations',
    detail: '4 conversations',
    targetKey: `pr:${SESSION_ID}`,
    fingerprint: `resolve-threads:${SESSION_ID}:4`,
    payload: { eligibleThreadCount: 4 },
  },
  {
    ...base,
    id: `rebase-project:${SESSION_ID}`,
    kind: 'rebase-project',
    priority: 40,
    band: 2,
    title: 'Rebase harbor-portal',
    detail: `${BEHIND.length} branches behind`,
    targetKey: null,
    fingerprint: `rebase-project:${SESSION_ID}`,
    payload: {
      targets: BEHIND.map(({ mount, behind }) => ({
        id: `mount:${mount.mountId}`,
        mountId: mount.mountId,
        projectId: mount.projectId,
        projectName: 'harbor-portal',
        branch: mount.branch,
        worktreePath: mount.worktreePath,
        baseBranch: 'main',
        behind,
        dirtyCount: 0,
      })),
    },
  },
  pushOf({
    mount: settings,
    state: 'diverged',
    title: 'Branch diverged from origin',
    detail: '2 commits here, 1 commit on origin',
    ahead: 2,
    behind: 1,
  }),
  pushOf({
    mount: search,
    state: 'ahead',
    title: 'Push 3 commits',
    detail: `harbor-portal · ${search.branch}`,
    ahead: 3,
    behind: 0,
  }),
  pushOf({
    mount: faq,
    state: 'not-pushed',
    title: 'Push the branch',
    detail: 'Not pushed yet · 4 commits',
    ahead: 4,
    behind: 0,
  }),
  {
    ...base,
    id: `open-pr:${pricing.mountId}`,
    kind: 'open-pr',
    priority: 42,
    band: 2,
    title: `Open a pull request for ${pricing.branch}`,
    detail: 'harbor-portal · 5 commits ahead of main',
    targetKey: `pr:${pricing.mountId}`,
    fingerprint: `open-pr:${pricing.mountId}`,
    payload: {
      mountId: pricing.mountId,
      projectId: pricing.projectId,
      projectName: 'harbor-portal',
      branch: pricing.branch,
      worktreePath: pricing.worktreePath,
      ahead: 5,
      scribe: null,
      targets: [],
    },
  },
  {
    ...base,
    id: `mark-ready:${careers.mountId}`,
    kind: 'mark-ready',
    priority: 43,
    band: 2,
    title: 'Mark #9991 ready for review',
    detail: 'All checks passed',
    targetKey: `pr:${careers.mountId}`,
    fingerprint: `mark-ready:${careers.mountId}`,
    payload: { mountId: careers.mountId, projectName: 'harbor-portal', prNumber: 9991 },
  },
  {
    ...base,
    id: `close-worktree:${contact.mountId}`,
    kind: 'close-worktree',
    priority: 51,
    band: 3,
    title: 'Remove the harbor-portal worktree',
    detail: '#9988 merged · 312 MB',
    targetKey: `worktree:${contact.mountId}`,
    fingerprint: `close-worktree:${contact.mountId}`,
    payload: {
      worktrees: [
        {
          mountId: contact.mountId,
          requestId: 'mock-next-cleanup',
          branch: contact.branch,
          prNumber: 9988,
        },
      ],
    },
  },
];

export type NextListSources = Readonly<{
  owners: ReadonlyArray<NeedsYouOwner>;
  suggestions: ReadonlyArray<SessionSuggestion>;
  autoTargets: ReadonlyArray<AutoActionTarget>;
}>;

export const NEXT_LIST_SOURCES: NextListSources = {
  owners: OWNERS,
  suggestions: SUGGESTIONS,
  autoTargets: AUTO_TARGETS,
};
