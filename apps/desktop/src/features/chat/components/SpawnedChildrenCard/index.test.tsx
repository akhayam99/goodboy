// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId } from '@goodboy/types';
import type { SpawnedChild } from '../../../../shared/utils/spawnedChildren';
import { SpawnedChildrenCard } from './index';

const child = (over: {
  id: string;
  index: number;
  name?: string;
  assignment?: string | null;
  status?: Agent['status'];
}): SpawnedChild => ({
  agent: {
    id: over.id as AgentId,
    sessionId: 's1',
    ordinal: over.index,
    name: over.name ?? over.id,
    status: over.status ?? 'pending',
  } as Agent,
  index: over.index,
  total: 2,
  status: over.status ?? 'pending',
  assignment: over.assignment === undefined ? `do ${over.index}` : over.assignment,
});

const spawned: ReadonlyArray<SpawnedChild> = [
  child({ id: 'c0', index: 0, name: 'auth' }),
  child({ id: 'c1', index: 1, name: 'routing' }),
];

afterEach(cleanup);

describe('SpawnedChildrenCard', () => {
  it('records every spawned child with its assignment excerpt', () => {
    render(<SpawnedChildrenCard spawned={spawned} />);
    expect(screen.getByText('auth')).toBeTruthy();
    expect(screen.getByText('routing')).toBeTruthy();
    expect(screen.getByText('do 0')).toBeTruthy();
    expect(screen.getByText('do 1')).toBeTruthy();
  });

  it('collapses and expands the record from the header', () => {
    render(<SpawnedChildrenCard spawned={spawned} />);
    fireEvent.click(screen.getByLabelText('collapse spawned agents'));
    expect(screen.queryByText('do 0')).toBeNull();
    fireEvent.click(screen.getByLabelText('expand spawned agents'));
    expect(screen.getByText('do 0')).toBeTruthy();
  });

  it('omits the assignment line when the spawn carried none', () => {
    render(<SpawnedChildrenCard spawned={[child({ id: 'c0', index: 0, assignment: null })]} />);
    expect(screen.getAllByText('c0')).toHaveLength(2);
    expect(screen.queryByText('do 0')).toBeNull();
  });

  it('hides the advance affordance when no plan owns the fan-out', () => {
    render(<SpawnedChildrenCard spawned={spawned} />);
    expect(screen.queryByTestId('spawned-children-advance')).toBeNull();
  });

  it('advances the first unfinished child after a confirming second click', () => {
    const onAdvance = vi.fn();
    render(<SpawnedChildrenCard spawned={spawned} onAdvance={onAdvance} />);
    const button = screen.getByTestId('spawned-children-advance');
    fireEvent.click(button);
    expect(onAdvance).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(onAdvance).toHaveBeenCalledWith('c0');
  });
});
