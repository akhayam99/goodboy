// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ArtifactFilterTabs } from './ArtifactFilterTabs';
import { ARTIFACT_FILTERS, type ArtifactFilter } from '../../artifactCollection';

afterEach(cleanup);

const counts = {
  all: 4,
  plan: 2,
  report: 1,
  wireframe: 1,
} satisfies Record<ArtifactFilter, number>;

describe('ArtifactFilterTabs', () => {
  it('keeps one line in the compact rail and lets the section eyebrows carry counts', () => {
    render(<ArtifactFilterTabs value="all" counts={counts} isCompact onChange={() => {}} />);
    const tablist = screen.getByRole('tablist', { name: 'Artifact kind' });

    expect(tablist.className).not.toContain('flex-wrap');
    expect(screen.getByRole('tab', { name: 'Plans' }).textContent).toBe('Plans');
  });

  it('keeps the max-content strip in the wide pane', () => {
    render(
      <ArtifactFilterTabs value="all" counts={counts} isCompact={false} onChange={() => {}} />,
    );
    const tablist = screen.getByRole('tablist', { name: 'Artifact kind' });

    expect(tablist.className).toContain('w-max');
    expect(tablist.className).not.toContain('flex-wrap');
  });

  it('renders every filter as a tab in the compact rail', () => {
    render(<ArtifactFilterTabs value="all" counts={counts} isCompact onChange={() => {}} />);

    expect(screen.getAllByRole('tab')).toHaveLength(ARTIFACT_FILTERS.length);
  });
});
