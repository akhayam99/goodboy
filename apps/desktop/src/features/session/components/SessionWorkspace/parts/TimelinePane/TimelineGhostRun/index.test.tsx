// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { TimelineEmpty } from '../TimelineEmpty';
import { TimelineGhostRun } from './';

afterEach(cleanup);

describe('the ghost run', () => {
  it('queues Scout, Planner and Implementer, with no model and no estimate', () => {
    render(<TimelineGhostRun />);

    const steps = within(screen.getByRole('list', { name: 'Steps a run takes' })).getAllByRole(
      'listitem',
    );
    expect(steps.map((step) => step.textContent)).toEqual([
      'ScoutQueued',
      'PlannerQueued',
      'ImplementerQueued',
    ]);
    screen.getByText('No model is chosen until a run starts');
    expect(document.body.textContent).not.toMatch(/\d+\s?(s|min|m|h)\b/);
  });
});

describe('an empty Activity', () => {
  it('says nothing ran and shows the ghost run under it', () => {
    render(<TimelineEmpty view="activity" isSearching={false} onClearSearch={vi.fn()} />);

    screen.getByText('Nothing ran yet');
    screen.getByRole('list', { name: 'Steps a run takes' });
  });

  it('shows no ghost run in the log or in a search with no match', () => {
    const { rerender } = render(
      <TimelineEmpty view="log" isSearching={false} onClearSearch={vi.fn()} />,
    );
    expect(screen.queryByRole('list', { name: 'Steps a run takes' })).toBeNull();

    rerender(<TimelineEmpty view="activity" isSearching onClearSearch={vi.fn()} />);
    expect(screen.queryByRole('list', { name: 'Steps a run takes' })).toBeNull();
  });
});
