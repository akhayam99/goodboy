// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { MountId, SessionId } from '@goodboy/types';

type RunRecord = {
  readonly status: 'idle' | 'pending' | 'ok' | 'error' | 'cancelled';
  readonly result: { stdout: string; stderr: string; exitCode: number } | null;
  readonly runId: string;
  readonly startedAt: number;
  readonly completedAt?: number;
  readonly output?: string;
};

const WORKTREE = '/work/ledger-core';
const TEST_KEY = JSON.stringify([WORKTREE, 'package-json', '', 'test']);

const { state } = vi.hoisted(() => ({
  state: {
    scriptRuns: {} as Record<string, Record<string, RunRecord>>,
    cancelScript: vi.fn(async () => undefined),
    runScript: vi.fn(async () => undefined),
    runDiscoveredScript: vi.fn(async () => undefined),
    queueOutputHandoff: vi.fn(),
    markScriptRunSeen: vi.fn(),
    isArchived: false,
  },
}));

vi.mock('../../../../store', () => {
  const getStoreState = () => ({
    sessions: [
      {
        id: 'session-1',
        workspaceId: 'ws-1',
        ...(state.isArchived && { archivedAt: '2026-10-20T10:00:00.000Z' }),
      },
    ],
    currentSessionId: 'session-1',
    sessionPhaseRuns: { 'session-1': [{ id: 'agent-implementer' }] },
    selectedAgentId: {},
    navigate: vi.fn(),
    queueOutputHandoff: state.queueOutputHandoff,
    markScriptRunSeen: state.markScriptRunSeen,
    projects: [{ id: 'project-ledger', workspaceId: 'ws-1', name: 'ledger-core' }],
    projectScripts: { 'ws-1': [] },
    sessionProjectMounts: {
      'session-1': [
        {
          mountId: 'mount-ledger',
          projectId: 'project-ledger',
          mountName: 'ledger-core',
          branch: 'nw/settlement',
          worktreePath: WORKTREE,
        },
      ],
    },
    discoveredScripts: {
      'session-1': {
        [WORKTREE]: [
          {
            source: 'package-json',
            packageName: 'ledger-core',
            relDir: '',
            manager: 'pnpm',
            scripts: [{ name: 'test', command: 'vitest run' }],
          },
        ],
      },
    },
    discoveredScriptScans: {},
    settings: {
      'scripts.pinned.project-ledger': JSON.stringify([
        JSON.stringify(['package-json', '', 'test']),
      ]),
    },
    detectedEditors: [],
    loadDetectedEditors: vi.fn(async () => undefined),
    openDrawer: vi.fn(),
    reportError: vi.fn(async () => undefined),
    loadScriptPins: vi.fn(async () => undefined),
    loadDiscoveredScripts: vi.fn(async () => undefined),
    scriptRuns: state.scriptRuns,
    cancelScript: state.cancelScript,
    runScript: state.runScript,
    runDiscoveredScript: state.runDiscoveredScript,
  });
  const useAppStore = <T,>(selector: (storeState: ReturnType<typeof getStoreState>) => T) =>
    selector(getStoreState());
  useAppStore.getState = getStoreState;
  return { EMPTY_ARRAY: [], useAppStore };
});

import { ScriptRunDrawer } from './index';

const SESSION_ID = 'session-1' as SessionId;
const MOUNT_ID = 'mount-ledger' as MountId;

const withRun = (record: RunRecord) => {
  state.scriptRuns = { 'session-1': { [TEST_KEY]: record } };
};

const renderDrawer = () =>
  render(
    <ScriptRunDrawer
      sessionId={SESSION_ID}
      scriptKey={TEST_KEY}
      mountId={MOUNT_ID}
      onClose={vi.fn()}
    />,
  );

beforeEach(() => {
  state.scriptRuns = {};
  state.cancelScript.mockClear();
  state.runScript.mockClear();
  state.runDiscoveredScript.mockClear();
  state.queueOutputHandoff.mockClear();
  state.isArchived = false;
});

afterEach(cleanup);

describe('ScriptRunDrawer', () => {
  it('follows a running script with one Stop action and names where it runs', () => {
    withRun({
      status: 'pending',
      result: null,
      runId: 'run-1',
      startedAt: Date.now() - 72_000,
      output: 'RUN  v2.1.0\n✓ postings/rounding.test.ts\n',
    });
    renderDrawer();

    expect(screen.getByRole('heading', { name: 'test' })).toBeDefined();
    expect(screen.getByText('ledger-core')).toBeDefined();
    expect(screen.getByLabelText('Running')).toBeDefined();
    expect(screen.getByText('1m 12s · nw/settlement')).toBeDefined();
    expect(screen.getByLabelText('Script output').textContent).toContain(
      '✓ postings/rounding.test.ts',
    );
    expect(screen.getByText('Following output')).toBeDefined();
    expect(screen.getAllByText('Output only. Stop ends it.')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Run again/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect(state.cancelScript).toHaveBeenCalledWith(SESSION_ID, TEST_KEY);
  });

  it('closes with a button named Close', () => {
    const onClose = vi.fn();
    render(
      <ScriptRunDrawer
        sessionId={SESSION_ID}
        scriptKey={TEST_KEY}
        mountId={MOUNT_ID}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the command closed until asked', () => {
    renderDrawer();

    const disclosure = screen.getByRole('button', { name: /Command/ });
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(disclosure);

    expect(disclosure.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('vitest run')).toBeDefined();
  });

  it('marks stderr lines with a word, not only color, and docks the exit', () => {
    withRun({
      status: 'error',
      result: { stdout: 'running 3 tests', stderr: 'rounding: off by 0.005 USD', exitCode: 1 },
      runId: 'run-1',
      startedAt: 1_000,
      completedAt: 13_000,
    });
    renderDrawer();

    const stderrLine = screen.getByText('rounding: off by 0.005 USD').parentElement;
    expect(stderrLine?.getAttribute('data-stream')).toBe('stderr');
    expect(stderrLine?.textContent).toContain('err');
    expect(screen.getByText('Exit 1')).toBeDefined();
    expect(screen.getAllByText('· 12s')).toHaveLength(1);
    expect(screen.queryByText('Failed')).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy output' })).toBeDefined();
  });

  it('runs again in the mount it opened on', () => {
    withRun({
      status: 'ok',
      result: { stdout: 'done', stderr: '', exitCode: 0 },
      runId: 'run-1',
      startedAt: 1_000,
      completedAt: 5_200,
    });
    renderDrawer();

    expect(screen.getByText('Exit 0')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Run again' }));

    expect(state.runDiscoveredScript).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      scriptId: TEST_KEY,
      name: 'test',
      command: 'vitest run',
      cwd: WORKTREE,
      mountId: MOUNT_ID,
    });
  });

  it('offers Jump to latest once the reader scrolls up, and follows again after it', () => {
    withRun({
      status: 'pending',
      result: null,
      runId: 'run-1',
      startedAt: Date.now(),
      output: Array.from({ length: 80 }, (_, index) => `line ${index}`).join('\n'),
    });
    renderDrawer();

    const viewport = screen.getByLabelText('Script output').parentElement;
    if (viewport === null) {
      throw new Error('missing log viewport');
    }
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1_600 });
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 300 });
    viewport.scrollTop = 200;
    act(() => {
      fireEvent.scroll(viewport);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Jump to latest' }));

    expect(viewport.scrollTop).toBe(1_600);
    expect(screen.queryByRole('button', { name: 'Jump to latest' })).toBeNull();
  });

  it('hands a failed run to the agent as an attachment titled with the script, exit and worktree', () => {
    withRun({
      status: 'error',
      result: { stdout: 'running 3 tests', stderr: 'rounding: off by 0.005 USD', exitCode: 1 },
      runId: 'run-1',
      startedAt: 1_000,
      completedAt: 13_000,
    });
    renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: 'Ask the agent about this' }));

    expect(state.queueOutputHandoff).toHaveBeenCalledTimes(1);
    const [{ agentId, handoff }] = state.queueOutputHandoff.mock.calls[0] ?? [{}];
    expect(agentId).toBe('agent-implementer');
    expect(handoff.title).toBe('Output of test, Exit 1, ledger-core on nw/settlement');
    expect(handoff.text).toContain('running 3 tests');
    expect(handoff.text).toContain('rounding: off by 0.005 USD');
    expect(state.runScript).not.toHaveBeenCalled();
    expect(state.cancelScript).not.toHaveBeenCalled();
  });

  it('offers the same verb while the run is live, once there is output to send', () => {
    withRun({
      status: 'pending',
      result: null,
      runId: 'run-1',
      startedAt: Date.now() - 5_000,
      output: 'RUN  v2.1.0\nError: connect ECONNREFUSED 127.0.0.1:5432\n',
    });
    renderDrawer();

    const ask = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Ask the agent about this',
    });
    expect(ask.disabled).toBe(false);
    fireEvent.click(ask);

    const [{ handoff }] = state.queueOutputHandoff.mock.calls[0] ?? [{}];
    expect(handoff.title).toBe('Output of test, Still running, ledger-core on nw/settlement');
    expect(handoff.text).toContain('ECONNREFUSED');
  });

  it('disables the verb while a live run has printed nothing', () => {
    withRun({ status: 'pending', result: null, runId: 'run-1', startedAt: Date.now() });
    renderDrawer();

    const ask = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Ask the agent about this',
    });
    expect(ask.disabled).toBe(true);
  });

  it('hides the verb in an archived session', () => {
    state.isArchived = true;
    withRun({
      status: 'error',
      result: { stdout: 'boom', stderr: '', exitCode: 2 },
      runId: 'run-1',
      startedAt: 1_000,
      completedAt: 2_000,
    });
    renderDrawer();

    expect(screen.queryByRole('button', { name: 'Ask the agent about this' })).toBeNull();
    screen.getByRole('button', { name: 'Copy output' });
  });
});
