// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: { openArtifactCreation: vi.fn(), sessions: [], workspaces: [] },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <Value,>(selector: (store: typeof state) => Value) => selector(state),
}));

import { ArtifactNewMenu } from './ArtifactNewMenu';
import { newArtifactEventName } from '../../newArtifactEventName';

const SESSION_ID: SessionId = JSON.parse('"session-1"');

afterEach(cleanup);

describe('ArtifactNewMenu', () => {
  it('opens its kinds when the trail asks for a new artifact', () => {
    render(<ArtifactNewMenu sessionId={SESSION_ID} isEmpty onImportWireframe={() => undefined} />);
    expect(screen.queryByText('Wireframe')).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent(newArtifactEventName(SESSION_ID)));
    });

    expect(screen.getByText('Wireframe')).toBeDefined();
    expect(screen.getByText('Report')).toBeDefined();
  });

  it('leaves Report and Wireframe to New in the head once the session has artifacts', () => {
    render(
      <ArtifactNewMenu
        sessionId={SESSION_ID}
        isEmpty={false}
        onImportWireframe={() => undefined}
      />,
    );

    expect(screen.queryByRole('button', { name: /New artifact/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Artifact files' }));
    expect(screen.queryByText('Report')).toBeNull();
    expect(screen.queryByText('Wireframe')).toBeNull();
    screen.getByRole('menuitem', { name: /Import wireframe JSON/ });
    screen.getByRole('menuitem', { name: /Show in Finder/ });
  });
});
