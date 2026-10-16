// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  MountId,
  ProjectId,
  PullRequestState,
  SessionMountView,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { useAppStore } from '../../../../store';
import { buildTimelineGroups } from '../../timeline/buildTimelineGroups';
import type { TimelineStreamEntry } from '../../timeline/buildTimelineStream';
import { brandedId } from '../../../history/testing/brandedId';
import { useTimelineOpen } from './index';

const SESSION = aSession();
const MOUNT = brandedId<MountId>({ value: 'mount-payments' });
const CHECK_URL = 'https://github.com/harborline/payments-api/actions/runs/31/job/42';

const PULL_REQUEST: PullRequestState = {
  number: 318,
  title: 'Guard the retry',
  url: CHECK_URL,
  state: 'open',
  mergeable: true,
  checks: 'failure',
  baseBranch: 'main',
  headBranch: 'ak/fix-retry',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-10-10T09:00:00.000Z',
};

type CheckAgentParams = {
  readonly id: string;
  readonly kind: string;
  readonly isFromCheck?: boolean;
};

type MountParams = {
  readonly id: string;
  readonly repoSlug: string | null;
  readonly isAttached?: boolean;
};

const mountOf = ({ id, repoSlug, isAttached = true }: MountParams): SessionMountView => ({
  id: brandedId<MountId>({ value: id }),
  sessionId: SESSION.id,
  projectId: brandedId<ProjectId>({ value: 'project-payments' }),
  repoRoot: `/repos/${id}`,
  worktreePath: `/work/${id}`,
  lastWorktreePath: null,
  branch: 'ak/fix-retry',
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: id,
  repoSlug,
  isAttached,
  diskState: 'present',
  revision: 1,
  createdAt: brandedId<IsoDateTime>({ value: '2026-10-10T09:00:00.000Z' }),
  updatedAt: brandedId<IsoDateTime>({ value: '2026-10-10T09:00:00.000Z' }),
});

const JOB_URL = 'https://github.com/harborline/payments-api/actions/runs/77/job/88';

const checkAgent = ({ id, kind, isFromCheck = true }: CheckAgentParams): Agent => ({
  id: brandedId<AgentId>({ value: id }),
  sessionId: SESSION.id,
  ordinal: 1,
  name: 'CI fix · payments-api / test · #318',
  status: 'completed',
  startedAt: brandedId<IsoDateTime>({ value: '2026-10-10T09:00:00.000Z' }),
  kind,
  ...(isFromCheck ? { sourceKind: 'failed_check' as const, sourceCommentUrl: CHECK_URL } : {}),
});

const entryOf = ({ agents }: { readonly agents: ReadonlyArray<Agent> }): TimelineStreamEntry => {
  const [entry] = buildTimelineGroups({
    sessionId: SESSION.id,
    agents,
    workflows: [],
    plans: [],
    artifacts: [],
    externalTasks: [],
    questions: [],
    worktrees: [],
    events: [],
    agentKindOverride: {},
  }).entries;
  if (entry === undefined || entry.kind !== 'agent') {
    throw new Error('the groups hold no agent');
  }
  return entry;
};

const knowTheCheck = () =>
  useAppStore.setState({
    mountGithub: {
      [MOUNT]: {
        mountId: MOUNT,
        projectId: brandedId<ProjectId>({ value: 'project-payments' }),
        revision: 1,
        repository: 'harborline/payments-api',
        host: 'github.com',
        branch: 'ak/fix-retry',
        prs: [PULL_REQUEST],
        links: [],
        pr: PULL_REQUEST,
        linkedIssues: [],
        fetchedAt: null,
        failedAt: null,
        loading: false,
        error: null,
        detail: null,
        detailFetchedAt: null,
        detailLoading: false,
        detailError: null,
      },
    },
  });

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ sessions: [SESSION] });
});

describe('the verb of a CI fix row', () => {
  it.each([
    { name: 'the CI debugger', kind: 'ci-debugger' },
    { name: 'a debugger an older version stored for a failed check', kind: 'debugger' },
  ])('opens the CI fix drawer on the check for $name', ({ kind }) => {
    knowTheCheck();
    const openDrawer = vi.fn();
    const navigate = vi.fn();
    useAppStore.setState({ openDrawer, navigate });
    const { result } = renderHook(() => useTimelineOpen({ sessionId: SESSION.id }));

    const target = result.current({
      entry: entryOf({ agents: [checkAgent({ id: 'agent-ci', kind })] }),
    });
    target?.open();

    expect(target?.label).toBe('Open CI fix');
    expect(openDrawer).toHaveBeenCalledWith({
      kind: 'check-analysis',
      sessionId: SESSION.id,
      payload: { sessionId: SESSION.id, mountId: MOUNT, checkUrl: CHECK_URL },
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the same drawer for the CI fixer', () => {
    knowTheCheck();
    const openDrawer = vi.fn();
    useAppStore.setState({ openDrawer });
    const { result } = renderHook(() => useTimelineOpen({ sessionId: SESSION.id }));

    const analysis = entryOf({ agents: [checkAgent({ id: 'agent-ci', kind: 'ci-debugger' })] });
    if (analysis.kind !== 'agent') {
      throw new Error('the analysis row is missing');
    }
    const fixer = checkAgent({ id: 'agent-fix', kind: 'ci-fixer' });
    const target = result.current({
      entry: { ...analysis, agent: fixer, agentKind: 'ci-fixer' },
    });
    target?.open();

    expect(target?.label).toBe('Open CI fix');
    expect(openDrawer).toHaveBeenCalledTimes(1);
  });

  it('falls back to the chat while the pull request of the check is not loaded', () => {
    const openDrawer = vi.fn();
    const navigate = vi.fn();
    useAppStore.setState({ openDrawer, navigate });
    const { result } = renderHook(() => useTimelineOpen({ sessionId: SESSION.id }));

    const target = result.current({
      entry: entryOf({ agents: [checkAgent({ id: 'agent-ci', kind: 'ci-debugger' })] }),
    });
    target?.open();

    expect(target?.label).toBe('Open chat');
    expect(openDrawer).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('keeps the chat for a debugger the user started', () => {
    knowTheCheck();
    const navigate = vi.fn();
    useAppStore.setState({ navigate });
    const { result } = renderHook(() => useTimelineOpen({ sessionId: SESSION.id }));
    const own = checkAgent({ id: 'agent-own', kind: 'debugger', isFromCheck: false });

    const target = result.current({ entry: entryOf({ agents: [own] }) });

    expect(target?.label).toBe('Open chat');
  });
});

describe('the CI fix row when the pull request detail is not loaded', () => {
  const rowOf = () => {
    const agent = {
      ...checkAgent({ id: 'agent-ci', kind: 'ci-fixer' }),
      sourceCommentUrl: JOB_URL,
    };
    const { result } = renderHook(() => useTimelineOpen({ sessionId: SESSION.id }));
    return result.current({ entry: entryOf({ agents: [agent] }) });
  };

  it.each([
    {
      name: 'exactly one mount holds the repo of the job URL',
      mounts: [
        mountOf({ id: 'mount-payments', repoSlug: 'Harborline/payments-api' }),
        mountOf({ id: 'mount-ledger', repoSlug: 'harborline/ledger-core' }),
      ],
      expected: 'mount-payments',
    },
    {
      name: 'the session holds one mount',
      mounts: [mountOf({ id: 'mount-only', repoSlug: null })],
      expected: 'mount-only',
    },
  ])('opens the drawer when $name', ({ mounts, expected }) => {
    const openDrawer = vi.fn();
    const navigate = vi.fn();
    useAppStore.setState({ openDrawer, navigate, sessionMounts: { [SESSION.id]: mounts } });

    const target = rowOf();
    target?.open();

    expect(target?.label).toBe('Open CI fix');
    expect(openDrawer).toHaveBeenCalledWith({
      kind: 'check-analysis',
      sessionId: SESSION.id,
      payload: {
        sessionId: SESSION.id,
        mountId: brandedId<MountId>({ value: expected }),
        checkUrl: JOB_URL,
      },
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'two mounts hold the repo of the job URL',
      mounts: [
        mountOf({ id: 'mount-a', repoSlug: 'harborline/payments-api' }),
        mountOf({ id: 'mount-b', repoSlug: 'harborline/payments-api' }),
      ],
    },
    { name: 'the session holds no mount', mounts: [] },
    {
      name: 'the only mount is detached',
      mounts: [mountOf({ id: 'mount-gone', repoSlug: null, isAttached: false })],
    },
    {
      name: 'several mounts and none holds the repo',
      mounts: [
        mountOf({ id: 'mount-a', repoSlug: 'harborline/ledger-core' }),
        mountOf({ id: 'mount-b', repoSlug: 'harborline/notify-relay' }),
      ],
    },
  ])('keeps the chat when $name', ({ mounts }) => {
    const openDrawer = vi.fn();
    useAppStore.setState({ openDrawer, sessionMounts: { [SESSION.id]: mounts } });

    const target = rowOf();

    expect(target?.label).toBe('Open chat');
    expect(openDrawer).not.toHaveBeenCalled();
  });
});
