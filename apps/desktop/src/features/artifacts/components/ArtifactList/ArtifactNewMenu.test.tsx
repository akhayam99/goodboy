// @vitest-environment happy-dom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: { openArtifactCreation: vi.fn() },
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
    render(<ArtifactNewMenu sessionId={SESSION_ID} onImportWireframe={() => undefined} />);
    expect(screen.queryByText('Wireframe')).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent(newArtifactEventName(SESSION_ID)));
    });

    expect(screen.getByText('Wireframe')).toBeDefined();
    expect(screen.getByText('Report')).toBeDefined();
  });
});
