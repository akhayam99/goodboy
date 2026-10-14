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
import { DEBUGGER_OPTIONS_TEXT } from '../../../app/components/MockScene/scenes/u25/debuggerSeed';
import { BranchChecks } from '../components/BranchChecks';
import { CheckAnalysisDrawer } from '../components/CheckAnalysisDrawer';
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

const fixers = () =>
  (store.getState().sessionPhaseRuns[seed.sessionId] ?? []).filter(
    (agent) => agent.kind === 'ci-fixer',
  );

describe('Start fix with the real store and SQLite', () => {
  beforeEach(async () => {
    seed = checksAnalyzeSeed({ phase: 'proposal' });
    await insertAgent(storySqlite(), {
      id: seed.agent.id,
      sessionId: seed.sessionId,
      ordinal: 1,
      name: seed.agent.name,
      status: 'completed',
      kind: 'ci-debugger',
      sourceKind: 'failed_check',
      sourceCommentUrl: seed.check.detailsUrl ?? seed.pullRequest.url,
    });
  });
  it('spawns one CI fixer under the CI debugger with the proposal and the check origin', async () => {
    const spawn = vi.spyOn(store.getState(), 'spawnAgent');
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Start fix' }));
    await waitFor(() => expect(spawn).toHaveBeenCalledTimes(1));
    expect(spawn).toHaveBeenCalledWith(
      seed.sessionId,
      expect.objectContaining({
        kindOverride: 'ci-fixer',
        name: `${seed.agent.name} · Fix`,
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
    await waitFor(() => expect(fixers().length).toBe(1));
    const child = fixers()[0];
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
    storySpies.listBranchCommits.mockResolvedValue([
      {
        sha: '9e4c1a7d3b5f60718293a4b5c6d7e8f901234567',
        shortSha: '9e4c1a7',
        subject: 'Guard the retry',
        author: 'Acme Dev',
        timestamp: Math.floor(Date.now() / 1_000) + 3_600,
        pushed: false,
        parentSha: null,
      },
    ]);
    act(() =>
      store.setState({
        sessionPhaseRuns: {
          [seed.sessionId]: (store.getState().sessionPhaseRuns[seed.sessionId] ?? []).map(
            (agent) =>
              agent.id === child.id
                ? { ...agent, status: 'completed' as const, startedAt: seed.events[0]!.at }
                : agent,
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
              input: { command: 'git commit -qam fix && git log --oneline -1' },
              at: seed.events[0]!.at,
            },
            {
              kind: 'tool_call_end',
              runId: FIX_RUN,
              toolUseId: 'c1',
              output: '9e4c1a7 fix\n',
              isError: false,
              at: seed.events[0]!.at,
            },
          ],
        },
      }),
    );
    await waitFor(() => expect(screen.getByText('Fixed, not pushed')).toBeDefined());
    expect(screen.queryByText('The fix stopped')).toBeNull();
    expect(store.getState().checkFixCommits[child.id]).toMatchObject({
      kind: 'found',
      sha: '9e4c1a7',
      unpushed: 1,
    });
    storySpies.listBranchCommits.mockResolvedValue([
      {
        sha: '9e4c1a7d3b5f60718293a4b5c6d7e8f901234567',
        shortSha: '9e4c1a7',
        subject: 'Guard the retry',
        author: 'Acme Dev',
        timestamp: Math.floor(Date.now() / 1_000) + 3_600,
        pushed: true,
        parentSha: null,
      },
    ]);
    await act(() =>
      store.getState().readCheckFixCommit({
        sessionId: seed.sessionId,
        mountId: seed.repo.mountId,
        fixAgentId: child.id,
      }),
    );
    expect(screen.getByText('Pushed, re-running')).toBeDefined();
  });
  it.each([
    {
      optionKey: 'B',
      included: 'Option B: Dedupe in the retry queue',
      excluded: ['Guard in the ledger', 'Option C'],
    },
    {
      optionKey: undefined,
      included: 'Option A: Guard in the ledger',
      excluded: ['Dedupe in the retry queue', 'Option C'],
    },
  ])(
    'seeds the Implementer with the finding and only the chosen option: $optionKey',
    async ({ optionKey, included, excluded }) => {
      seed = checksAnalyzeSeed({ phase: 'proposal', analysisText: DEBUGGER_OPTIONS_TEXT });
      const spawn = vi.spyOn(store.getState(), 'spawnAgent');
      await startCheckFix({
        sessionId: seed.sessionId,
        url: seed.check.detailsUrl ?? '',
        mountId: seed.repo.mountId,
        ...(optionKey !== undefined && { optionKey }),
      });
      const prompt = spawn.mock.calls[0]?.[1].initialPrompt ?? '';
      expect(prompt).toContain('The retry path applies the credit again');
      expect(prompt).toContain(included);
      for (const text of excluded) {
        expect(prompt).not.toContain(text);
      }
      expect(prompt).not.toContain('Recommended: A');
      expect(prompt).toContain('Make this fix on this branch, commit it, and push nothing.');
    },
  );
  it('starts the option picked in the drawer and no other', async () => {
    seed = checksAnalyzeSeed({ phase: 'proposal', analysisText: DEBUGGER_OPTIONS_TEXT });
    const spawn = vi.spyOn(store.getState(), 'spawnAgent');
    render(
      <ToastProvider>
        <CheckAnalysisDrawer
          sessionId={seed.sessionId}
          mountId={seed.repo.mountId}
          checkUrl={seed.check.detailsUrl ?? ''}
          onClose={() => undefined}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /Option C/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start option C' }));
    await waitFor(() => expect(spawn).toHaveBeenCalledTimes(1));
    const prompt = spawn.mock.calls[0]?.[1].initialPrompt ?? '';
    expect(prompt).toContain('Option C: Make credits idempotent by key');
    expect(prompt).not.toContain('Dedupe in the retry queue');
    expect(prompt).not.toContain('Guard in the ledger');
    await waitFor(() => expect(fixers().length).toBe(1));
  });
  it('reads as one row in Activity: the CI fix row keeps the CI fixer out of the tree', async () => {
    await startCheckFix({
      sessionId: seed.sessionId,
      url: seed.check.detailsUrl ?? '',
      mountId: seed.repo.mountId,
    });
    const agents = store.getState().sessionPhaseRuns[seed.sessionId] ?? [];
    expect(agents.map((agent) => agent.kind)).toEqual(['ci-debugger', 'ci-fixer']);
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
      throw new Error('The CI fix row is missing');
    }
    expect(top.agent.id).toBe(seed.agent.id);
    expect(top.agentKind).toBe('ci-debugger');
    expect(top.children).toEqual([]);
    expect(top.chain).toBeNull();
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
    expect(fixers().length).toBe(1);
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
    expect(fixers()).toEqual([]);
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
    expect(fixers()).toEqual([]);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Start fix' }).hasAttribute('disabled')).toBe(
        false,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start fix' }));
    await waitFor(() => expect(fixers().length).toBe(1));
  });
});
