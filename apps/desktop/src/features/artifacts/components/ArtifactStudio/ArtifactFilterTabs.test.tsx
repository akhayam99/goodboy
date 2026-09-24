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
  it('renders every filter as a tab', () => {
    render(<ArtifactFilterTabs value="all" counts={counts} onChange={() => {}} />);

    expect(screen.getByRole('tablist', { name: 'Artifact kind' })).toBeDefined();
    expect(screen.getAllByRole('tab')).toHaveLength(ARTIFACT_FILTERS.length);
  });
});
