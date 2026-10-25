import type { AutoDelegation, AutoTree } from '@goodboy/db';
import {
  brandId,
  type Agent,
  type AgentId,
  type AutoDelegationId,
  type AutoTreeId,
  type IsoDateTime,
  type SessionEvent,
  type SessionEventId,
} from '@goodboy/types';
import { autoRetryTargetsOf } from '../../../../../../features/auto/autoRetryTargetsOf';
import {
  aDelegation,
  aPlanRow,
  aTree,
  aView,
  FIXTURE_NOW,
} from '../../../../../../features/auto/testing/autoViewFixtures';
import type { NeedsYouOwner } from '../../../../../../features/session/timeline/needsYou';
import {
  historyStopTitleOf,
  segmentsToText,
  sessionEventLabel,
} from '../../../../../../features/session/timeline/sessionEventPresentation';
import { historyStopDetailOf } from '../../../../../../features/history/historyStopDetailOf';
import { hiddenChildIdsOf } from '../../../../../../store/slices/auto-view/hiddenChildIdsOf';
import { presentDelegationsOf } from '../../../../../../store/slices/auto-view/presentDelegationsOf';
import type { AutoTreeView } from '../../../../../../store/slices/auto-view/state';
import { SESSION_ID } from '../../resolveSeed';
import { NEXT_LIST_MOUNTS, type NextListMount } from './nextListMounts';
import { NEXT_LIST_SOURCES, type NextListSources } from './nextListSources';

const MINUTE_MS = 60_000;

const ROLLOUT_AUTO = brandId<AgentId>({ value: 'mock-next-auto-rollout' });
const PROFILE_AUTO = brandId<AgentId>({ value: 'mock-next-auto-profile' });

const BLOCKED_IN_ITALIAN =
  'Non riesco a chiudere: lo snapshot della home fallisce perché manca la fixture dei dati di esempio per la sezione statistiche.';

type TreeParams = {
  readonly key: string;
  readonly rootAgentId: AgentId;
};

const treeOf = ({ key, rootAgentId }: TreeParams): AutoTree => ({
  ...aTree({ phase: 'waiting' }),
  id: brandId<AutoTreeId>({ value: `mock-next-tree-${key}` }),
  rootAgentId,
  sessionId: SESSION_ID,
});

type ChildParams = {
  readonly key: string;
  readonly tree: AutoTree;
  readonly role: string;
  readonly title: string;
  readonly mount: NextListMount;
  readonly minute: number;
  readonly state: AutoDelegation['state'];
  readonly outcome?: AutoDelegation['outcome'];
  readonly reason?: string | null;
  readonly result?: unknown;
};

const childOf = ({
  key,
  tree,
  role,
  title,
  mount,
  minute,
  state,
  outcome = null,
  reason = null,
  result = null,
}: ChildParams): AutoDelegation => ({
  ...aDelegation({ key, role, state, outcome, result }),
  id: brandId<AutoDelegationId>({ value: `mock-next-delegation-${key}` }),
  treeId: tree.id,
  childAgentId: brandId<AgentId>({ value: `mock-next-agent-${key}` }),
  slot: minute,
  request: { task: title, title },
  target: { mountId: mount.mountId },
  reason,
  createdAt: FIXTURE_NOW - (60 - minute) * MINUTE_MS,
  settledAt: state === 'settled' ? FIXTURE_NOW - (40 - minute) * MINUTE_MS : null,
});

const ROLLOUT = treeOf({ key: 'rollout', rootAgentId: ROLLOUT_AUTO });
const PROFILE = treeOf({ key: 'profile', rootAgentId: PROFILE_AUTO });

const { home, billing, search, settings, profile, about, contact } = NEXT_LIST_MOUNTS;

const ROLLOUT_CHILDREN: ReadonlyArray<AutoDelegation> = [
  childOf({
    key: 'home-implementer-first',
    tree: ROLLOUT,
    role: 'implementer',
    title: 'Build the hero of the home page',
    mount: home,
    minute: 1,
    state: 'settled',
    outcome: 'stopped',
    reason: 'stopped',
  }),
  childOf({
    key: 'home-implementer',
    tree: ROLLOUT,
    role: 'implementer',
    title: 'Build the hero and stats strip of the home page',
    mount: home,
    minute: 2,
    state: 'settled',
    outcome: 'blocked',
    reason: 'declared_blocked',
    result: { declared: { summary: BLOCKED_IN_ITALIAN } },
  }),
  childOf({
    key: 'home-tester',
    tree: ROLLOUT,
    role: 'tester',
    title: 'Test the home page hero',
    mount: home,
    minute: 3,
    state: 'settled',
    outcome: 'timed_out',
    reason: 'deadline_passed',
  }),
  childOf({
    key: 'billing-reviewer-first',
    tree: ROLLOUT,
    role: 'reviewer',
    title: 'Review the invoice table',
    mount: billing,
    minute: 4,
    state: 'settled',
    outcome: 'stopped',
    reason: 'stopped',
  }),
  childOf({
    key: 'billing-reviewer',
    tree: ROLLOUT,
    role: 'reviewer',
    title: 'Review the billing page after the fixes',
    mount: billing,
    minute: 5,
    state: 'settled',
    outcome: 'timed_out',
    reason: 'deadline_passed',
  }),
  childOf({
    key: 'search-scout',
    tree: ROLLOUT,
    role: 'scout',
    title: 'Map the search filters',
    mount: search,
    minute: 6,
    state: 'accepted',
  }),
  childOf({
    key: 'settings-implementer',
    tree: ROLLOUT,
    role: 'implementer',
    title: 'Move the settings form to tabs',
    mount: settings,
    minute: 7,
    state: 'settled',
    outcome: 'stopped',
    reason: 'declined',
  }),
];

const LEFT_CHILDREN: ReadonlyArray<AutoDelegation> = [
  childOf({
    key: 'contact-tester-deleted',
    tree: ROLLOUT,
    role: 'tester',
    title: 'Ask which branch the contact form tests belong on',
    mount: contact,
    minute: 8,
    state: 'settled',
    outcome: 'failed',
    reason: 'stopped',
  }),
  childOf({
    key: 'contact-reviewer-moved',
    tree: ROLLOUT,
    role: 'reviewer',
    title: 'Review the contact form',
    mount: contact,
    minute: 9,
    state: 'settled',
    outcome: 'blocked',
    reason: 'declared_blocked',
  }),
];

const LEFT_CHILD_IDS: ReadonlySet<AgentId> = new Set(
  LEFT_CHILDREN.map((delegation) => delegation.childAgentId),
);

const ROLLOUT_DELEGATIONS = [...ROLLOUT_CHILDREN, ...LEFT_CHILDREN];

const ROLLOUT_PRESENT = presentDelegationsOf({
  delegations: ROLLOUT_DELEGATIONS,
  goneChildIds: LEFT_CHILD_IDS,
});

const VIEWS: ReadonlyArray<AutoTreeView> = [
  {
    ...aView({
      phase: 'waiting',
      artifacts: [aPlanRow({ title: 'Center pages rollout', revision: 3 })],
    }),
    tree: ROLLOUT,
    delegations: ROLLOUT_PRESENT,
    hiddenChildIds: hiddenChildIdsOf({
      delegations: ROLLOUT_DELEGATIONS,
      present: ROLLOUT_PRESENT,
    }),
  },
  {
    ...aView({
      phase: 'waiting',
      artifacts: [aPlanRow({ title: 'Profile page polish', revision: 1 })],
    }),
    tree: PROFILE,
  },
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
    mountId: mount.mountId,
    stopLines: {
      title: historyStopTitleOf({ event }),
      detail: historyStopDetailOf({ payload: event.payload }),
    },
  };
};

type SceneAgentParams = {
  readonly id: AgentId;
  readonly parentAgentId?: AgentId;
};

const sceneAgentOf = ({ id, parentAgentId }: SceneAgentParams): Agent => ({
  id,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: id,
  status: 'running',
  ...(parentAgentId === undefined ? {} : { parentAgentId }),
});

const AGENTS: ReadonlyArray<Agent> = VIEWS.flatMap((view) => [
  sceneAgentOf({ id: view.tree.rootAgentId }),
  ...view.delegations.map((delegation) =>
    sceneAgentOf({ id: delegation.childAgentId, parentAgentId: view.tree.rootAgentId }),
  ),
]);

export const NEXT_LIST_BUILT_SOURCES: NextListSources = {
  owners: [
    rebaseStoppedOf({ mount: home, minute: 12 }),
    rebaseStoppedOf({ mount: billing, minute: 14 }),
    rebaseStoppedOf({ mount: profile, minute: 17 }),
  ],
  suggestions: NEXT_LIST_SOURCES.suggestions.map((suggestion) => {
    if (suggestion.kind === 'resolve-threads') {
      return { ...suggestion, targetKey: `pr:${about.mountId}` };
    }
    if (suggestion.kind === 'answer-questions') {
      return { ...suggestion, payload: { ...suggestion.payload, rootAgentId: ROLLOUT_AUTO } };
    }
    return suggestion;
  }),
  autoTargets: autoRetryTargetsOf({ views: VIEWS, agents: AGENTS, now: FIXTURE_NOW }),
};
