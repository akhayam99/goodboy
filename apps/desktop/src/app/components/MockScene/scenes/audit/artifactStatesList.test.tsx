// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ArtifactStudio } from '../../../../../features/artifacts/components/ArtifactStudio';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { SESSION_ID, seedArtifactScene } from '../artifactSeed';

beforeEach(() => {
  seedArtifactScene({ focusedArtifactId: null, withStates: true });
});

afterEach(cleanup);

const renderList = () =>
  render(
    <ToastProvider>
      <ArtifactStudio sessionId={SESSION_ID} />
    </ToastProvider>,
  );

describe('the artifact states list', () => {
  it('groups as Needs you, Running, Ready, To read, Used, then Recently deleted', async () => {
    const { container } = renderList();
    await screen.findAllByTestId('artifact-row-state');

    const groups = Array.from(container.querySelectorAll('[data-list-grid-group-label] h2')).map(
      (heading) => heading.textContent,
    );
    expect(groups).toEqual([
      'Needs you',
      'Running',
      'Ready',
      'To read',
      'Used',
      'Recently deleted',
    ]);
  });

  it('reads Unread, never New, on a report nobody opened', async () => {
    renderList();
    await screen.findAllByTestId('artifact-row-state');

    const states = screen.getAllByTestId('artifact-row-state').map((node) => node.textContent);
    expect(states).toContain('Unread');
    expect(states).not.toContain('New');
  });
});
