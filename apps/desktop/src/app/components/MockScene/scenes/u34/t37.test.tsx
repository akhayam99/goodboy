// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { PullRequestStatusStrip } from '../../../../../features/branch/components/PullRequestTab/PullRequestStatusStrip';
import type { StatusCell } from '../../../../../features/branch/components/PullRequestTab/statusCell';
import { U34_T37_SCENES } from './t37';

afterEach(cleanup);

const cellsWith = ({ word }: { readonly word: string }): ReadonlyArray<StatusCell> => [
  { id: 'checks', label: 'Checks', word, detail: null, tone: 'neutral', opens: 'checks' },
  { id: 'review', label: 'Review', word: 'Approved', detail: null, tone: 'success', opens: null },
  { id: 'merge', label: 'Merge', word: 'Clear', detail: null, tone: 'success', opens: null },
  { id: 'branch', label: 'Branch', word: 'Up to date', detail: null, tone: 'success', opens: null },
];

describe('the u34 pr page loading scene', () => {
  it('registers for the capture and shows the activity skeleton', () => {
    expect(MOCK_SCENES['u34-t37-pr-page-loading']).toBe(U34_T37_SCENES['u34-t37-pr-page-loading']);
    const Scene = U34_T37_SCENES['u34-t37-pr-page-loading'];
    render(<Scene />);

    screen.getByRole('status', { name: 'Reading the activity' });
    screen.getByRole('group', { name: 'Status' });
  });

  it('draws shapes, not claims, until the data is known: four pending cells and four rows', () => {
    const Scene = U34_T37_SCENES['u34-t37-pr-page-loading'];
    const { container } = render(<Scene />);

    expect(container.querySelectorAll('[data-cell][data-pending]')).toHaveLength(4);
    expect(container.querySelector('[data-pr-status-strip]')?.textContent).toBe(
      'ChecksReviewMergeBranch',
    );
    const rows = screen.getByRole('status', { name: 'Reading the activity' }).children;
    expect(rows).toHaveLength(4);
  });

  it('keeps the same four strip cells whatever word the checks cell carries', () => {
    const stripOf = ({ word }: { readonly word: string }) => (
      <PullRequestStatusStrip cells={cellsWith({ word })} onOpen={() => undefined} />
    );
    const { rerender, container } = render(stripOf({ word: 'Checking' }));
    const strip = container.querySelector('[data-pr-status-strip]');
    const cellIds = () =>
      [...container.querySelectorAll('[data-cell]')].map((cell) => cell.getAttribute('data-cell'));
    expect(cellIds()).toEqual(['checks', 'review', 'merge', 'branch']);

    rerender(stripOf({ word: '3 failing, lint, unit tests and the long migration suite' }));

    expect(container.querySelector('[data-pr-status-strip]')).toBe(strip);
    expect(cellIds()).toEqual(['checks', 'review', 'merge', 'branch']);
  });
});
