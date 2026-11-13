// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { PrCheckRun } from '@goodboy/types';
import { checksSummaryOf } from '../../../../features/integrations/github/checksRollup';
import { ChecksProperty } from '.';

afterEach(cleanup);

const run = (conclusion: PrCheckRun['conclusion'], name: string): PrCheckRun => ({
  name,
  conclusion,
  detailsUrl: null,
  durationMs: null,
});

describe('ChecksProperty', () => {
  it('shows the count line of the summary with one segment per run', () => {
    const runs = [
      run('success', 'build'),
      run('success', 'unit tests'),
      run('success', 'e2e'),
      run('success', 'types'),
      run('success', 'deploy preview'),
      run('success', 'audit'),
      run('failure', 'lint'),
    ];
    const summary = checksSummaryOf({ runs });
    const { container } = render(<ChecksProperty summary={summary} />);

    expect(screen.getByTestId('checks-line').textContent).toBe('6 of 7 passed');
    expect(screen.getByTestId('checks-line').textContent).toBe(summary?.line);
    expect(container.querySelectorAll('[data-slot="checks-bar"] li')).toHaveLength(7);
    const failing = screen.getByRole('list', { name: 'Failing checks' });
    expect(failing.textContent).toBe('lintFailed');
  });

  it('names at most three failing checks', () => {
    const runs = ['a', 'b', 'c', 'd', 'e'].map((name) => run('failure', `job ${name}`));
    render(<ChecksProperty summary={checksSummaryOf({ runs })} />);

    expect(
      within(screen.getByRole('list', { name: 'Failing checks' })).getAllByRole('listitem'),
    ).toHaveLength(3);
  });

  it('draws nothing without runs', () => {
    const { container } = render(<ChecksProperty summary={null} />);

    expect(container.textContent).toBe('');
  });
});
