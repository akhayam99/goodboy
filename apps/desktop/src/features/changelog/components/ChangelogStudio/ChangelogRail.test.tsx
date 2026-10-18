// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReleaseEntry } from '../../parseChangelog';
import { ChangelogRail } from './ChangelogRail';

const buildRelease = (version: string): ReleaseEntry => ({
  version,
  shape: 'markdown',
  lead: null,
  oneWayFrom: null,
  sections: { new: [], improved: [], fixed: [] },
  markdown: `notes for ${version}`,
  publishedAt: null,
});

afterEach(() => {
  cleanup();
});

type RenderRailParams = {
  readonly releases: ReadonlyArray<ReleaseEntry>;
  readonly dates?: Readonly<Record<string, string>>;
  readonly query?: string;
  readonly onQueryChange?: (query: string) => void;
  readonly catchUp?: Parameters<typeof ChangelogRail>[0]['catchUp'];
};

const renderRail = ({
  releases,
  dates = {},
  query = '',
  onQueryChange = vi.fn(),
  catchUp = null,
}: RenderRailParams) =>
  render(
    <ChangelogRail
      releases={releases}
      selectedVersion={null}
      installedVersion={null}
      dates={dates}
      query={query}
      onQueryChange={onQueryChange}
      catchUp={catchUp}
      isCatchUpSelected={false}
      onSelect={vi.fn()}
      onSelectCatchUp={vi.fn()}
    />,
  );

describe('ChangelogRail', () => {
  it('gives every minor from 0.4 on its own eyebrow, and collapses older ones', () => {
    renderRail({
      releases: [
        buildRelease('0.7.0'),
        buildRelease('0.6.0'),
        buildRelease('0.3.14'),
        buildRelease('0.1.0'),
      ],
    });

    expect(screen.getByText('0.7')).toBeDefined();
    expect(screen.getByText('0.6')).toBeDefined();
    expect(screen.getByText(/Older/)).toBeDefined();
    expect(screen.queryByText('0.7.0')).not.toBeNull();
    expect(screen.queryByText('0.3.14')).toBeNull();
  });

  it('expands the older group on click', () => {
    renderRail({ releases: [buildRelease('0.7.0'), buildRelease('0.3.14')] });

    fireEvent.click(screen.getByText(/Older/));

    expect(screen.getByText('0.3.14')).toBeDefined();
  });

  it('shows the catch-up row when one is provided', () => {
    renderRail({
      releases: [buildRelease('0.7.0'), buildRelease('0.6.0')],
      catchUp: { fromVersion: '0.5.3', releases: [buildRelease('0.7.0'), buildRelease('0.6.0')] },
    });

    expect(screen.getByText(/Since 0.5.3/)).toBeDefined();
  });

  it('dates every row from the dates table', () => {
    renderRail({
      releases: [buildRelease('0.7.0'), buildRelease('0.6.0')],
      dates: { '0.7.0': '2026-10-17T09:00:00Z' },
    });

    expect(screen.getByText('0.7.0').nextElementSibling?.textContent).toMatch(/Oct/);
    expect(screen.getByText('0.6.0').nextElementSibling?.textContent).toBe('');
  });

  it('searches with the shared rail field', () => {
    const onQueryChange = vi.fn();
    renderRail({ releases: [buildRelease('0.7.0')], query: 'export', onQueryChange });

    const field = screen.getByRole('searchbox', { name: 'Search releases' });
    fireEvent.change(field, { target: { value: 'exports' } });

    expect(onQueryChange).toHaveBeenCalledWith('exports');
    expect(document.querySelector('[data-rail-search]')).not.toBeNull();
  });
});
