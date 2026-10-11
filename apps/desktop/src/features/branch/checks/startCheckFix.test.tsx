// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../chat/turn', async () =>
  (await import('../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../worktree/worktree', async () =>
  (await import('../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../providers/routing', async () =>
  (await import('../../../store/storyHarness')).routingModuleMock(),
);

vi.mock('../../permissions/permissions', async () =>
  (await import('../../../store/storyHarness')).permissionsModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProviderRunId } from '@goodboy/types';

const FIX_RUN: ProviderRunId = JSON.parse(JSON.stringify('run-fix'));
import { insertAgent, insertSession, insertWorkspace } from '@goodboy/db';
import { aSession } from '@goodboy/types/testing';
import {
  buildStoryWorkspace,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  storySqlite,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../store/storyHarness';
import { ToastProvider } from '../../../shared/components/Toast';
import { checksAnalyzeSeed } from '../../../app/components/MockScene/scenes/u24/checksAnalyzeSeed';
import { BranchChecks } from '../components/BranchChecks';
import { startCheckFix } from './startCheckFix';
import { buildTimelineGroups } from '../../session/timeline/buildTimelineGroups';
import { buildTimelineStream } from '../../session/timeline/buildTimelineStream';
import { needsYouOwners } from '../../session/timeline/needsYou';
import { dayLabel } from '../../session/timeline/dayLabel';
import { resetWorktreeStatusCache } from '../../../store/slices/worktreeStatuses/cache';

let store: StoryStore;
let seed: ReturnType<typeof checksAnalyzeSeed>;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  vi.clearAllMocks();
  await resetStoryStore();
  resetWorktreeStatusCache();
  const status = await storySpies.worktreeStatus('/mock/payments-api');
  storySpies.worktreeStatus.mockResolvedValue(
    Object.assign({}, status, { mainDistance: { kind: 'known', behind: 0, ahead: 0 } }),
  );
  storySpies.worktreeChangedFiles.mockResolvedValue(
    Object.assign(
      { files: [], numstat: '' },
      { paths: ['src/ledger.ts'], entries: [], additions: 0, deletions: 0 },
    ),
  );
  seed = checksAnalyzeSeed({ phase: 'failing' });
  const db = await openStorySqlite();
  const session = store.getState().sessions.find((row) => row.id === seed.sessionId);
  if (session === undefined) {
    throw new Error('The seeded session is missing');
  }
  await insertWorkspace({ db, workspace: buildStoryWorkspace({ id: session.workspaceId }) });
  await insertSession(db, aSession({ id: session.id, workspaceId: session.workspaceId }));
  storySpies.tauriInvoke.mockImplementation(async (command, args) => {
    if (command === 'gh_run') {
      const input: unknown = args;
      const hasFiles =
        typeof input === 'object' &&
        input !== null &&
        'args' in input &&
        Array.isArray(input.args) &&
        input.args.includes('files');
      return {
        stdout: hasFiles ? 'src/ledger.ts\nsrc/ledger.test.ts\n' : 'Assertion failed',
        stderr: '',
        exitCode: 0,
      };
    }
    return null;
  });
});
afterEach(async () => {
  await waitFor(() =>
    expect(Object.values(store.getState().sessionCreations).flat().length).toBe(0),
  );
  await waitFor(() =>
    expect(
      Object.values(store.getState().agentTurnState).some(
        (turn) => turn.kind === 'starting' || turn.kind === 'running',
      ),
    ).toBe(false),
  );
  cleanup();
  vi.restoreAllMocks();
});

const show = () =>
  render(
    <ToastProvider>
      <BranchChecks sessionId={seed.sessionId} />
    </ToastProvider>,
  );

const implementers = () =>
  (store.getState().sessionPhaseRuns[seed.sessionId] ?? []).filter(
    (agent) => agent.kind === 'implementer',
  );

describe('Start fix with the real store and SQLite', () => {
  beforeEach(async () => {
    seed = checksAnalyzeSeed({ phase: 'proposal' });
    await insertAgent(storySqlite(), {
      id: seed.agent.id,
      sessionId: seed.sessionId,
      ordinal: 1,
      name: 'Debugger',
      status: 'completed',
      kind: 'debugger',
      sourceKind: 'failed_check',
      sourceCommentUrl: seed.check.detailsUrl ?? seed.pullRequest.url,
    });
  });
  it('spawns one Implementer under the Debugger with the proposal and the check origin', async () => {
    const spawn = vi.spyOn(store.getState(), 'spawnAgent');
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Start fix' }));
    await waitFor(() => expect(spawn).toHaveBeenCalledTimes(1));
    expect(spawn).toHaveBeenCalledWith(
      seed.sessionId,
      expect.objectContaining({
        kindOverride: 'implementer',
        parentAgentId: seed.agent.id,
        sourceKind: 'failed_check',
        sourceCommentUrl: seed.check.detailsUrl,
        initialPrompt: expect.stringContaining('Add an idempotency guard in src/ledger.ts'),
      }),
    );
    expect(spawn.mock.calls[0]?.[1].initialPrompt).toContain(
      'Make this fix on this branch, commit it, and push nothing.',
    );
    expect(spawn.mock.calls[0]?.[1].mountId).toBe(seed.repo.mountId);
    await waitFor(() => expect(implementers().length).toBe(1));
    const child = implementers()[0];
    if (child === undefined) {
      throw new Error('The Implementer is missing');
    }
    act(() =>
      store.setState({
        agentTurnState: {
          ...store.getState().agentTurnState,
          [child.id]: {
            kind: 'running',
            runId: FIX_RUN,
            startedAt: seed.events[0]!.at,
          },
        },
      }),
    );
    expect(screen.getByText('Implementer is fixing')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Start fix' })).toBeNull();
    act(() =>
      store.setState({
        sessionPhaseRuns: {
          [seed.sessionId]: (store.getState().sessionPhaseRuns[seed.sessionId] ?? []).map(
            (agent) => (agent.id === child.id ? { ...agent, status: 'completed' as const } : agent),
          ),
        },
        agentTurnState: {
          ...store.getState().agentTurnState,
          [child.id]: { kind: 'ended', endedAt: seed.events[0]!.at },
        },
        transcripts: {
          ...store.getState().transcripts,
          [child.id]: [
            {
              kind: 'tool_call_start',
              runId: FIX_RUN,
              toolUseId: 'c1',
              toolName: 'Bash',
              input: { command: 'git commit -m fix' },
              at: seed.events[0]!.at,
            },
            {
              kind: 'tool_call_end',
              runId: FIX_RUN,
              toolUseId: 'c1',
              output: '[acme/fix-credits 9e4c1a7] fix',
              isError: false,
              at: seed.events[0]!.at,
            },
          ],
        },
      }),
    );
    expect(
      screen.getByText('Fixed by Implementer. The checks run again when you push.'),
    ).toBeDefined();
  });
  it('reads as one tree in Activity: the Debugger on top, the Implementer its only child', async () => {
    await startCheckFix({
      sessionId: seed.sessionId,
      url: seed.check.detailsUrl ?? '',
      mountId: seed.repo.mountId,
    });
    const agents = store.getState().sessionPhaseRuns[seed.sessionId] ?? [];
    const { entries } = buildTimelineGroups({
      sessionId: seed.sessionId,
      agents,
      workflows: [],
      plans: [],
      artifacts: [],
      externalTasks: [],
      questions: [],
      worktrees: [],
      events: [],
      agentKindOverride: {},
    });
    expect(entries).toHaveLength(1);
    const top = entries[0];
    if (top === undefined || top.kind !== 'agent') {
      throw new Error('The Debugger row is missing');
    }
    expect(top.agent.id).toBe(seed.agent.id);
    expect(top.children.map((child) => child.agent.kind)).toEqual(['implementer']);
    expect(top.children[0]?.agent.parentAgentId).toBe(seed.agent.id);
  });
  it('keeps the offer out of Needs you', () => {
    const agents = store.getState().sessionPhaseRuns[seed.sessionId] ?? [];
    const { entries } = buildTimelineGroups({
      sessionId: seed.sessionId,
      agents,
      workflows: [],
      plans: [],
      artifacts: [],
      externalTasks: [],
      questions: [],
      worktrees: [],
      events: [],
      agentKindOverride: {},
    });
    const { items } = buildTimelineStream({
      entries,
      unreadAgentIds: new Set(),
      advanceByRunId: new Map(),
      decidingRunIds: new Set(),
      dayLabelFor: ({ at }) => dayLabel({ at, now: new Date(at) }),
    });
    expect(needsYouOwners({ items, entries: [], events: [] })).toEqual([]);
  });
  it('starts once from two doors and the second sees the child', async () => {
    const spawn = vi.spyOn(store.getState(), 'spawnAgent');
    const url = seed.check.detailsUrl ?? '';
    const [first, second] = await Promise.all([
      startCheckFix({ sessionId: seed.sessionId, url, mountId: seed.repo.mountId }),
      startCheckFix({ sessionId: seed.sessionId, url, mountId: seed.repo.mountId }),
    ]);
    expect(first).toBe(second);
    expect(
      await startCheckFix({ sessionId: seed.sessionId, url, mountId: seed.repo.mountId }),
    ).toBe(first);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(implementers().length).toBe(1);
    show();
    expect(screen.getByText('Implementer is fixing')).toBeDefined();
  });
  it('refuses when there is no proposal and spawns nothing', async () => {
    seed = checksAnalyzeSeed({ phase: 'no-fix' });
    await expect(
      startCheckFix({
        sessionId: seed.sessionId,
        url: seed.check.detailsUrl ?? '',
        mountId: seed.repo.mountId,
      }),
    ).rejects.toThrow('The proposal is no longer available');
    expect(implementers()).toEqual([]);
  });
  it('shows the failure and keeps Start fix to retry when the spawn fails', async () => {
    injectDbFault({ match: /INSERT INTO agents/, message: 'provider unavailable' });
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Start fix' }));
    await waitFor(() =>
      expect(
        store
          .getState()
          .notifications.some((notice) => notice.title === "Couldn't start the Implementer"),
      ).toBe(true),
    );
    expect(implementers()).toEqual([]);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Start fix' }).hasAttribute('disabled')).toBe(
        false,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start fix' }));
    await waitFor(() => expect(implementers().length).toBe(1));
  });
});
