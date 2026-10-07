// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { PrCheckRun } from '@goodboy/types';
import { PrChecks } from './PrChecks';

afterEach(() => {
  cleanup();
});

const run = (patch: Partial<PrCheckRun> & Pick<PrCheckRun, 'name' | 'conclusion'>): PrCheckRun => ({
  detailsUrl: null,
  durationMs: null,
  ...patch,
});

const FALLBACK = 'https://github.com/harborline/payments-api/pull/318/checks';

const draw = ({
  checks,
  hostLabel = 'GitHub',
  isLoading,
  onOpenUrl = vi.fn(),
}: {
  readonly checks: ReadonlyArray<PrCheckRun>;
  readonly hostLabel?: string;
  readonly isLoading?: boolean;
  readonly onOpenUrl?: (url: string) => void;
}) =>
  render(
    <PrChecks
      checks={checks}
      fallbackUrl={FALLBACK}
      hostLabel={hostLabel}
      isLoading={isLoading}
      onOpenUrl={onOpenUrl}
    />,
  );

describe('PrChecks while the checks are being read', () => {
  it('says it is reading, never that nothing ran', () => {
    draw({ checks: [], isLoading: true });

    expect(screen.getByRole('status').textContent).toBe('Reading checks');
    expect(screen.queryByText(/No checks have reported/)).toBeNull();
    expect(screen.queryByText(/No CI runs/)).toBeNull();
  });

  it('keeps the rows it already has while a refresh runs', () => {
    draw({ checks: [run({ name: 'unit tests', conclusion: 'success' })], isLoading: true });

    expect(screen.queryByText('Reading checks')).toBeNull();
    expect(screen.getByRole('button', { name: /unit tests/ })).toBeDefined();
  });
});

describe('PrChecks with runs', () => {
  const checks: ReadonlyArray<PrCheckRun> = [
    run({ name: 'build', conclusion: 'success', durationMs: 90_000 }),
    run({ name: 'unit tests', conclusion: 'failure', detailsUrl: 'https://ci.invalid/runs/3' }),
    run({ name: 'lint', conclusion: 'pending' }),
    run({ name: 'docs preview', conclusion: 'skipped' }),
    run({ name: 'types', conclusion: 'success' }),
  ];

  it('reads one rollup line, failing first', () => {
    draw({ checks });

    expect(screen.getByTestId('checks-rollup').textContent).toBe(
      '1 failing · 1 running · 2 passed · 1 skipped',
    );
  });

  it('groups the rows as Failing, Running, Passed and Skipped', () => {
    draw({ checks });

    const lists = screen.getAllByRole('list').map((list) => list.getAttribute('aria-label'));
    expect(lists).toEqual(['Failing checks', 'Running checks', 'Passed checks', 'Skipped checks']);
    expect(
      within(screen.getByRole('list', { name: 'Passed checks' }))
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['build1m 30s', 'types']);
  });

  it('opens the log of a run on its host, and the checks page when the run has none', () => {
    const onOpenUrl = vi.fn();
    draw({ checks, onOpenUrl });

    fireEvent.click(screen.getByRole('button', { name: /unit tests/ }));
    fireEvent.click(screen.getByRole('button', { name: /lint/ }));

    expect(onOpenUrl.mock.calls).toEqual([['https://ci.invalid/runs/3'], [FALLBACK]]);
  });
});

describe('PrChecks with nothing reported', () => {
  it('says no checks have reported on this pull request yet, and offers the host', () => {
    const onOpenUrl = vi.fn();
    draw({ checks: [], onOpenUrl });

    expect(screen.getByText('No checks have reported on this pull request yet')).toBeDefined();
    expect(screen.queryByText(/runs no checks/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /View on GitHub/ }));
    expect(onOpenUrl).toHaveBeenCalledWith(FALLBACK);
  });

  it('names the host it was given', () => {
    draw({ checks: [], hostLabel: 'Bitbucket' });

    expect(screen.getByRole('button', { name: /View on Bitbucket/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /GitHub/ })).toBeNull();
  });
});
