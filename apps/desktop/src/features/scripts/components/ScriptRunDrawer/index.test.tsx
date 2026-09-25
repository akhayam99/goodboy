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
  },
}));

vi.mock('../../../../store', () => {
  const getStoreState = () => ({
    sessions: [{ id: 'session-1', workspaceId: 'ws-1' }],
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
    expect(screen.getByText('Running')).toBeDefined();
    expect(screen.getByText('· ledger-core')).toBeDefined();
    expect(screen.getByText('· nw/settlement')).toBeDefined();
    expect(screen.getByText('✓ postings/rounding.test.ts')).toBeDefined();
    expect(screen.getByText('Following output')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Run again/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect(state.cancelScript).toHaveBeenCalledWith(SESSION_ID, TEST_KEY);
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
    expect(screen.getAllByText('· 12s')).toHaveLength(2);
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
});
