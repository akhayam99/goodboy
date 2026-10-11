// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProjectScriptId } from '@goodboy/types';
import type { RunnableScript } from '../../buildSessionScripts';
import type { ScriptLiveFacts } from '../../scriptLiveFacts';
import type { ScriptRunRecord } from '../../scripts';
vi.mock('../../../../shared/lib/editor', () => ({ openUrl: vi.fn() }));

import { openUrl } from '../../../../shared/lib/editor';
import { ScriptRow } from './index';

const NOW = Date.parse('2026-09-16T11:30:00.000Z');

const TEST: RunnableScript = {
  key: 'manifest-test',
  kind: 'manifest',
  name: 'test',
  body: 'vitest run',
  invocation: 'yarn run test',
  manager: 'yarn',
  source: 'package-json',
  packageName: '@acme/web',
  relDir: 'apps/web',
  category: 'test',
  savedId: null,
};

const DEV: RunnableScript = {
  key: 'manifest-dev',
  kind: 'manifest',
  name: 'dev',
  body: 'vite --port 5005',
  invocation: 'pnpm run dev',
  manager: 'pnpm',
  source: 'package-json',
  packageName: 'payments-api',
  relDir: '',
  category: 'dev',
  savedId: null,
};

const REPLAY: RunnableScript = {
  key: 'saved-replay',
  kind: 'saved',
  name: 'Replay settlement batch',
  body: 'pnpm --filter ledger-core exec node ./tools/replay.mjs',
  invocation: 'pnpm --filter ledger-core exec node ./tools/replay.mjs',
  manager: '',
  source: 'saved',
  packageName: '',
  relDir: '',
  category: 'other',
  savedId: 'saved-replay' as ProjectScriptId,
};

type RenderParams = {
  readonly script?: RunnableScript;
  readonly record?: ScriptRunRecord | null;
  readonly isSelected?: boolean;
  readonly blockedReason?: string | null;
  readonly expectedPort?: number | null;
  readonly portHolder?: string | null;
  readonly facts?: ScriptLiveFacts | null;
  readonly onOpen?: () => void;
  readonly onRun?: () => void;
  readonly onStop?: () => void;
  readonly onRestart?: () => void;
};

const renderRow = ({
  script = TEST,
  record = null,
  isSelected = false,
  blockedReason = null,
  expectedPort = null,
  portHolder = null,
  facts = null,
  onOpen = vi.fn(),
  onRun = vi.fn(),
  onStop = vi.fn(),
  onRestart = vi.fn(),
}: RenderParams) =>
  render(
    <ScriptRow
      script={script}
      record={record}
      now={NOW}
      isSelected={isSelected}
      blockedReason={blockedReason}
      expectedPort={expectedPort}
      portHolder={portHolder}
      facts={facts}
      isPinned={false}
      onTogglePin={vi.fn()}
      target={{
        kind: 'script',
        facts: {
          name: script.name,
          command: script.invocation,
          isRunning: false,
          runBlockedReason: blockedReason,
          onShowOutput: vi.fn(),
          onRun: vi.fn(),
          onStop: vi.fn(),
          onEdit: null,
          onDuplicate: null,
          onSaveAs: null,
          onDelete: null,
        },
      }}
      onOpen={onOpen}
      onRun={onRun}
      onStop={onStop}
      onRestart={onRestart}
    />,
  );

const runningDev = (output: string): ScriptRunRecord => ({
  status: 'pending',
  result: null,
  runId: 'run-dev',
  startedAt: NOW - 72_000,
  output,
});

afterEach(cleanup);

describe('ScriptRow task', () => {
  it('shows the name and no source column', () => {
    renderRow({});

    expect(screen.getByText('test')).toBeDefined();
    expect(screen.queryByText('package.json')).toBeNull();
  });

  it('keeps Run visible at rest and offers Stop in its place while it runs', () => {
    const onStop = vi.fn();
    renderRow({ script: REPLAY });
    expect(
      screen.getByRole('button', { name: `Run ${REPLAY.name}` }).closest('[data-reveal]'),
    ).toBeNull();
    cleanup();

    renderRow({
      script: REPLAY,
      record: { status: 'pending', result: null, runId: 'run-1', startedAt: NOW - 72_000 },
      onStop,
    });
    expect(screen.queryByRole('button', { name: `Run ${REPLAY.name}` })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: `Stop ${REPLAY.name}` }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('reads a passed run as its duration and age', () => {
    renderRow({
      record: {
        status: 'ok',
        result: { stdout: '', stderr: '', exitCode: 0 },
        runId: 'run-2',
        startedAt: NOW - 124_200,
        completedAt: NOW - 120_000,
      },
    });

    expect(screen.getByText('4.2s · 2m ago')).toBeDefined();
  });

  it('reads a failed run as its exit code and shows its last line', () => {
    renderRow({
      record: {
        status: 'error',
        result: {
          stdout: 'running 12 tests\nAssertionError: expected 3 to equal 4\n',
          stderr: '',
          exitCode: 1,
        },
        runId: 'run-1',
        startedAt: NOW - 12 * 60_000 - 12_000,
        completedAt: NOW - 12 * 60_000,
      },
    });

    expect(screen.getByText('Exit 1 · 12m ago')).toBeDefined();
    expect(screen.getByText('AssertionError: expected 3 to equal 4')).toBeDefined();
  });

  it('reads a cancelled run as Stopped', () => {
    renderRow({
      record: {
        status: 'cancelled',
        result: null,
        runId: 'run-3',
        startedAt: NOW - 3_600_000,
        completedAt: NOW - 3_600_000,
      },
    });

    expect(screen.getByText(/^Stopped/)).toBeDefined();
  });

  it('opens the output from the row and runs from its button', () => {
    const onOpen = vi.fn();
    const onRun = vi.fn();
    renderRow({ onOpen, onRun });

    fireEvent.click(screen.getByRole('button', { name: 'Show test output' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run test' }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it('marks the row whose output is open', () => {
    const { container } = renderRow({ isSelected: true });

    expect(container.querySelector('[data-selected="true"]')).not.toBeNull();
  });

  it('explains why a row cannot run yet', () => {
    renderRow({ blockedReason: 'ledger-core is still preparing' });

    const run = screen.getByRole('button', { name: 'Run test' });
    expect(run.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('ledger-core is still preparing')).toBeDefined();
  });

  it('keeps pin and the overflow behind hover and focus', () => {
    renderRow({});

    for (const name of ['Pin test', 'More for test']) {
      expect(screen.getByRole('button', { name }).closest('[data-reveal="hover"]')).not.toBeNull();
    }
  });

  it('opens the overflow from a horizontal glyph', () => {
    renderRow({});

    const trigger = screen.getByRole('button', { name: 'More for test' });
    expect(trigger.querySelector('svg.lucide-ellipsis')).not.toBeNull();
    expect(trigger.querySelector('svg.lucide-ellipsis-vertical')).toBeNull();
  });
});

describe('ScriptRow service', () => {
  it('shows the expected port as a faint chip when idle', () => {
    renderRow({ script: DEV, expectedPort: 5005 });

    expect(screen.getByText(':5005')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Run dev' })).toBeDefined();
  });

  it('shows the last line, uptime, cpu, memory and the port link while running', () => {
    renderRow({
      script: DEV,
      expectedPort: 5005,
      record: runningDev('ready in 312 ms\nlistening on 5005\n'),
      facts: { pid: 4242, ports: [5005], cpuPercent: 12.4, rssBytes: 150 * 1024 * 1024 },
    });

    expect(screen.getByText('listening on 5005')).toBeDefined();
    expect(screen.getByText('1m 12s')).toBeDefined();
    expect(screen.getByText('12%')).toBeDefined();
    expect(screen.getByText('150 MB')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open localhost:5005' }));
    expect(openUrl).toHaveBeenCalledWith('http://localhost:5005');
  });

  it('keeps Stop and Restart visible at rest while running', () => {
    const onStop = vi.fn();
    const onRestart = vi.fn();
    renderRow({ script: DEV, record: runningDev('ready'), onStop, onRestart });

    const stop = screen.getByRole('button', { name: 'Stop dev' });
    const restart = screen.getByRole('button', { name: 'Restart dev' });
    expect(stop.closest('[data-reveal]')).toBeNull();
    expect(restart.closest('[data-reveal]')).toBeNull();
    fireEvent.click(stop);
    fireEvent.click(restart);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('reads an exit by signal 9 as Exit 137 with the last line', () => {
    renderRow({
      script: DEV,
      record: {
        status: 'error',
        result: { stdout: 'ready\nkilled\n', stderr: '', exitCode: 137 },
        runId: 'run-dev',
        startedAt: NOW - 90_000,
        completedAt: NOW - 30_000,
      },
    });

    expect(screen.getByText('Exit 137')).toBeDefined();
    expect(screen.getByText('killed')).toBeDefined();
  });

  it('warns when another worktree holds the port and still allows Run', () => {
    renderRow({
      script: DEV,
      expectedPort: 5005,
      portHolder: 'payments-api · hl/ledger-rounding holds it',
    });

    expect(screen.getByText(':5005 in use')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Run dev' }).hasAttribute('disabled')).toBe(false);
  });
});
