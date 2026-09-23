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

const renderGroups = () =>
  render(
    <ArtifactGroups
      plans={[]}
      groups={[]}
      counts={counts}
      filter="all"
      openQuestionCount={0}
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
  it('shows the kind tabs and the empty state when nothing matches the filter', () => {
    renderGroups();

    expect(screen.getByRole('tablist', { name: 'Artifact kind' })).toBeDefined();
    expect(screen.getByText('nothing of this kind in this session yet')).toBeDefined();
  });
});
