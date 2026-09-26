// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProjectScriptId } from '@goodboy/types';
import type { RunnableScript } from '../../buildSessionScripts';
import type { ScriptRunRecord } from '../../scripts';
import { ScriptRow } from './index';

const NOW = Date.parse('2026-09-16T11:30:00.000Z');

const TEST: RunnableScript = {
  key: 'manifest-test',
  kind: 'manifest',
  name: 'test',
  command: 'vitest run',
  source: 'package-json',
  packageName: '@acme/web',
  relDir: 'apps/web',
  category: 'test',
  savedId: null,
};

const REPLAY: RunnableScript = {
  key: 'saved-replay',
  kind: 'saved',
  name: 'Replay settlement batch',
  command: 'pnpm --filter ledger-core exec node ./tools/replay.mjs',
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
  readonly onOpen?: () => void;
  readonly onRun?: () => void;
  readonly onStop?: () => void;
};

const renderRow = ({
  script = TEST,
  record = null,
  isSelected = false,
  blockedReason = null,
  onOpen = vi.fn(),
  onRun = vi.fn(),
  onStop = vi.fn(),
}: RenderParams) =>
  render(
    <ScriptRow
      script={script}
      record={record}
      now={NOW}
      isSelected={isSelected}
      blockedReason={blockedReason}
      menuItems={[{ kind: 'item', key: 'copy', label: 'Copy command', onClick: vi.fn() }]}
      onOpen={onOpen}
      onRun={onRun}
      onStop={onStop}
    />,
  );

afterEach(cleanup);

describe('ScriptRow', () => {
  it('shows name, command and where the script comes from on one line', () => {
    renderRow({});

    expect(screen.getByText('test')).toBeDefined();
    expect(screen.getByText('vitest run')).toBeDefined();
    expect(screen.getByText('package.json')).toBeDefined();
  });

  it('says a running script is running and offers Stop in place of Run', () => {
    const onStop = vi.fn();
    renderRow({
      script: REPLAY,
      record: { status: 'pending', result: null, runId: 'run-1', startedAt: NOW - 72_000 },
      onStop,
    });

    expect(screen.getByText('Running')).toBeDefined();
    expect(screen.getByText('1m 12s')).toBeDefined();
    expect(screen.queryByRole('button', { name: `Run ${REPLAY.name}` })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: `Stop ${REPLAY.name}` }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('names a failed run by its exit code and a passed run by its duration', () => {
    renderRow({
      record: {
        status: 'error',
        result: { stdout: '', stderr: '', exitCode: 1 },
        runId: 'run-1',
        startedAt: NOW - 12 * 60_000 - 12_000,
        completedAt: NOW - 12 * 60_000,
      },
    });
    expect(screen.getByText('Exit 1')).toBeDefined();
    expect(screen.getByText('· 12m ago')).toBeDefined();
    cleanup();

    renderRow({
      record: {
        status: 'ok',
        result: { stdout: '', stderr: '', exitCode: 0 },
        runId: 'run-2',
        startedAt: NOW - 124_200,
        completedAt: NOW - 120_000,
      },
    });
    expect(screen.getByText('4.2s')).toBeDefined();
    expect(screen.getByText('· 2m ago')).toBeDefined();
    cleanup();

    renderRow({
      record: {
        status: 'cancelled',
        result: null,
        runId: 'run-3',
        startedAt: NOW - 3_600_000,
        completedAt: NOW - 3_600_000,
      },
    });
    expect(screen.getByText('Stopped')).toBeDefined();
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
});
