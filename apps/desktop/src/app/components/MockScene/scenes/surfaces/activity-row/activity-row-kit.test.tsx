// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MOCK_SCENES } from '../../..';
import { ACTIVITY_ROW_KIT_SCENES } from './activity-row-kit';

afterEach(cleanup);

describe('activity row kit scene', () => {
  it('registers the scene and its light twin for the capture', () => {
    expect(Object.keys(ACTIVITY_ROW_KIT_SCENES)).toEqual([
      'activity-row-kit',
      'activity-row-kit-light',
    ]);
    expect(MOCK_SCENES['activity-row-kit']).toBe(ACTIVITY_ROW_KIT_SCENES['activity-row-kit']);
    expect(MOCK_SCENES['activity-row-kit-light']).toBe(
      ACTIVITY_ROW_KIT_SCENES['activity-row-kit-light'],
    );
  });

  it('draws the Agents list, the feed and the run steps on quiet nodes, with a bar only where something needs you or broke', () => {
    const Scene = ACTIVITY_ROW_KIT_SCENES['activity-row-kit'];
    render(<Scene />);

    const agents = screen.getByRole('region', { name: 'Agents list' });
    within(agents).getByText(
      'Post one credit per retry in postCredit and applyCredit, then dedupe the batch path in ledger-core',
    );
    within(agents).getByText('You · read at turn 6');
    screen.getByRole('region', { name: 'Activity' });
    screen.getByRole('region', { name: 'Workflow run' });
    for (const node of document.querySelectorAll('[data-node-state]')) {
      expect(node.getAttribute('data-node-look')).toBe('quiet');
    }
    const barTones = Array.from(screen.getAllByTestId('tone-bar')).map((bar) =>
      bar.getAttribute('data-tone'),
    );
    expect(barTones.sort()).toEqual(['danger', 'danger', 'warning', 'warning']);
  });

  it('shows no cost for a run that cost nothing', () => {
    const Scene = ACTIVITY_ROW_KIT_SCENES['activity-row-kit'];
    render(<Scene />);

    expect(screen.queryByText('$0')).toBeNull();
    screen.getByText('$0.12');
  });
});
