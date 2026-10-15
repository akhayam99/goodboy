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
