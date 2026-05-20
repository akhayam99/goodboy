// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AgentStatus, ProviderRunId } from '@goodboy/types';
import { ParallelProgressPill } from '../features/chat/components/ParallelProgressPill';

function rid(s: string): ProviderRunId {
  return s as ProviderRunId;
}

const runIds: ReadonlyArray<ProviderRunId> = [rid('r1'), rid('r2'), rid('r3'), rid('r4')];

const statusList: ReadonlyArray<AgentStatus> = ['running', 'completed', 'failed', 'skipped'];

const statuses = Object.fromEntries(runIds.map((r, i) => [r, statusList[i]])) as Readonly<
  Record<ProviderRunId, AgentStatus>
>;

afterEach(cleanup);

describe('ParallelProgressPill', () => {
  it('renders N badges for N runIds', () => {
    const onSelectRun = vi.fn();
    render(
      <ParallelProgressPill
        parallelRunIds={runIds}
        runStatuses={statuses}
        onSelectRun={onSelectRun}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
  });

  it('assigns correct aria-label per badge', () => {
    const onSelectRun = vi.fn();
    render(
      <ParallelProgressPill
        parallelRunIds={runIds}
        runStatuses={statuses}
        onSelectRun={onSelectRun}
      />,
    );
    expect(screen.getByRole('button', { name: 'run p1: running' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'run p2: completed' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'run p3: failed' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'run p4: skipped' })).toBeDefined();
  });

  it('click on badge calls onSelectRun with correct runId', () => {
    const onSelectRun = vi.fn();
    render(
      <ParallelProgressPill
        parallelRunIds={runIds}
        runStatuses={statuses}
        onSelectRun={onSelectRun}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'run p2: completed' }));
    expect(onSelectRun).toHaveBeenCalledOnce();
    expect(onSelectRun).toHaveBeenCalledWith(rid('r2'));
  });

  it('click on each badge calls onSelectRun with its specific runId', () => {
    const onSelectRun = vi.fn();
    render(
      <ParallelProgressPill
        parallelRunIds={runIds}
        runStatuses={statuses}
        onSelectRun={onSelectRun}
      />,
    );
    runIds.forEach((runId, i) => {
      fireEvent.click(screen.getByRole('button', { name: `run p${i + 1}: ${statusList[i]}` }));
      expect(onSelectRun).toHaveBeenNthCalledWith(i + 1, runId);
    });
    expect(onSelectRun).toHaveBeenCalledTimes(4);
  });

  it('returns null when parallelRunIds is empty', () => {
    const onSelectRun = vi.fn();
    const { container } = render(
      <ParallelProgressPill
        parallelRunIds={[]}
        runStatuses={{} as Readonly<Record<ProviderRunId, AgentStatus>>}
        onSelectRun={onSelectRun}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('falls back to pending status when runId not in runStatuses', () => {
    const onSelectRun = vi.fn();
    render(
      <ParallelProgressPill
        parallelRunIds={[rid('unknown')]}
        runStatuses={{} as Readonly<Record<ProviderRunId, AgentStatus>>}
        onSelectRun={onSelectRun}
      />,
    );
    expect(screen.getByRole('button', { name: 'run p1: pending' })).toBeDefined();
  });
});
