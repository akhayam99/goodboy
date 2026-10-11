// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { EMPTY_OVERRIDES } from '@goodboy/types/testing';
import { SESSION, WORKSPACE, sessionFixture } from '../../../../__tests__/helpers/actionFixtures';

const { openSpy } = vi.hoisted(() => ({
  openSpy: vi.fn(async (_args: unknown) => undefined),
}));

vi.mock('../../artifactMirror/artifactMirrorInvoke', () => ({
  openArtifactsFolder: (args: unknown) => openSpy(args),
}));

import { useAppStore } from '../../../../store';
import { ArtifactListFolderButton } from './ArtifactListFolderButton';

const sessionId: SessionId = SESSION;
const workspaceId: WorkspaceId = WORKSPACE;

afterEach(cleanup);

describe('ArtifactListFolderButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      sessions: [sessionFixture({ id: sessionId, workspaceId })],
      workspaces: [
        {
          id: workspaceId,
          name: 'Harborline',
          slug: 'harborline',
          overrides: EMPTY_OVERRIDES,
          createdAt: sessionFixture().createdAt,
          updatedAt: sessionFixture().updatedAt,
        },
      ],
    });
  });

  it('shows the artifacts folder from a visible button, with no menu behind it', () => {
    render(<ArtifactListFolderButton sessionId={sessionId} />);

    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show in Finder' }));

    expect(openSpy).toHaveBeenCalledWith({ workspaceSlug: 'harborline' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('is disabled while the workspace is not known', () => {
    useAppStore.setState({ workspaces: [] });
    render(<ArtifactListFolderButton sessionId={sessionId} />);

    expect(screen.getByRole('button', { name: 'Show in Finder' })).toHaveProperty('disabled', true);
  });
});
