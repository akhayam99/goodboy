// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ArtifactBlockCard } from './index';

afterEach(cleanup);

describe('ArtifactBlockCard', () => {
  it('announces a captured artifact with its kind and title', () => {
    render(
      <ArtifactBlockCard
        item={{
          kind: 'artifact_block',
          key: 'text-0-artifact-0',
          artifactKind: 'report',
          title: 'Release readout',
          complete: true,
        }}
      />,
    );
    const row = screen.getByTestId('artifact-block-row');
    expect(row.textContent).toContain('report captured');
    expect(row.textContent).toContain('Release readout');
  });

  it('shows a pending row while the block is still arriving', () => {
    render(
      <ArtifactBlockCard
        item={{
          kind: 'artifact_block',
          key: 'text-0-artifact-0',
          artifactKind: 'wireframe',
          title: null,
          complete: false,
        }}
      />,
    );
    expect(screen.getByTestId('artifact-block-row').textContent).toContain(
      'wireframe still arriving',
    );
  });

  it('never opens an expanded body', () => {
    const { container } = render(
      <ArtifactBlockCard
        item={{
          kind: 'artifact_block',
          key: 'text-0-artifact-0',
          artifactKind: 'plan',
          title: 'Rollout',
          complete: true,
        }}
      />,
    );
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});
