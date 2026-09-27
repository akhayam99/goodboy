// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId, WorkspaceId } from '@goodboy/types';

const { openSpy } = vi.hoisted(() => ({
  openSpy: vi.fn(async (_args: unknown) => undefined),
}));

vi.mock('../../artifactMirror/artifactMirrorInvoke', () => ({
  openArtifactsFolder: (args: unknown) => openSpy(args),
}));

import { useAppStore } from '../../../../store';
import { ArtifactListOverflowMenu } from './ArtifactListOverflowMenu';

const sessionId = 'session-1' as SessionId;
const workspaceId = 'workspace-1' as WorkspaceId;

afterEach(cleanup);

describe('ArtifactListOverflowMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      sessions: [{ id: sessionId, workspaceId } as never],
      workspaces: [{ id: workspaceId, slug: 'harborline' } as never],
    });
  });

  it('opens the workspace artifacts folder from More', () => {
    render(<ArtifactListOverflowMenu sessionId={sessionId} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open artifacts folder' }));
    expect(openSpy).toHaveBeenCalledWith({ workspaceSlug: 'harborline' });
  });
});
