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

const renderRail = (releases: ReadonlyArray<ReleaseEntry>) =>
  render(
    <ChangelogRail
      releases={releases}
      dates={{}}
      selectedVersion={null}
      installedVersion={null}
      query=""
      onQueryChange={vi.fn()}
      catchUp={null}
      isCatchUpSelected={false}
      onSelect={vi.fn()}
      onSelectCatchUp={vi.fn()}
    />,
  );

describe('ChangelogRail', () => {
  it('gives every minor from 0.4 on its own eyebrow, and collapses older ones', () => {
    renderRail([
      buildRelease('0.7.0'),
      buildRelease('0.6.0'),
      buildRelease('0.3.14'),
      buildRelease('0.1.0'),
    ]);

    expect(screen.getByText('0.7')).toBeDefined();
    expect(screen.getByText('0.6')).toBeDefined();
    expect(screen.getByText(/Older/)).toBeDefined();
    expect(screen.queryByText('0.7.0')).toBeDefined();
    expect(screen.queryByText('0.3.14')).toBeNull();
  });

  it('expands the older group on click', () => {
    renderRail([buildRelease('0.7.0'), buildRelease('0.3.14')]);

    fireEvent.click(screen.getByText(/Older/));

    expect(screen.getByText('0.3.14')).toBeDefined();
  });

  it('shows the catch-up row when one is provided', () => {
    renderRail([buildRelease('0.7.0'), buildRelease('0.6.0')]);
    cleanup();
    render(
      <ChangelogRail
        releases={[buildRelease('0.7.0'), buildRelease('0.6.0')]}
        dates={{}}
        selectedVersion={null}
        installedVersion={null}
        query=""
        onQueryChange={vi.fn()}
        catchUp={{ fromVersion: '0.5.3', releases: [buildRelease('0.7.0'), buildRelease('0.6.0')] }}
        isCatchUpSelected
        onSelect={vi.fn()}
        onSelectCatchUp={vi.fn()}
      />,
    );

    expect(screen.getByText(/Since 0.5.3/)).toBeDefined();
  });
});
