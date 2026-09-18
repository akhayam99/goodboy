// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ArtifactGroups } from './ArtifactGroups';
import type { ArtifactFilter } from '../../artifactCollection';

afterEach(cleanup);

const counts = {
  all: 0,
  plan: 0,
  report: 0,
  wireframe: 0,
} satisfies Record<ArtifactFilter, number>;

type RenderParams = {
  readonly isCompact: boolean;
};

const renderGroups = ({ isCompact }: RenderParams) =>
  render(
    <ArtifactGroups
      plans={[]}
      groups={[]}
      counts={counts}
      filter="all"
      openQuestionCount={0}
      selectedArtifactId={null}
      selectedGenerationAgentId={null}
      isCompact={isCompact}
      empty={<p>nothing of this kind in this session yet</p>}
      onFilterChange={() => {}}
      onSelectPlan={() => {}}
      onSelectArtifact={() => {}}
      onSelectGeneration={() => {}}
      onStopGeneration={() => {}}
      onRetryGeneration={() => {}}
    />,
  );

describe('ArtifactGroups', () => {
  it('hands the compact rail a wrapping strip with no horizontal scroller around it', () => {
    renderGroups({ isCompact: true });
    const tablist = screen.getByRole('tablist', { name: 'Artifact kind' });

    expect(tablist.closest('.overflow-x-auto')).toBeNull();
    expect(tablist.className).toContain('flex-wrap');
  });

  it('keeps the wide pane strip inside the horizontal scroller', () => {
    renderGroups({ isCompact: false });
    const tablist = screen.getByRole('tablist', { name: 'Artifact kind' });
    const viewport = tablist.closest('.overflow-x-auto');

    expect(viewport).not.toBeNull();
    expect(tablist.className).toContain('w-max');
    expect(viewport?.parentElement?.className).not.toContain('min-w-0');
    expect(viewport?.parentElement?.className).toContain('shrink-0');
  });
});
