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
import { ArtifactNewMenu } from './ArtifactNewMenu';

const sessionId: SessionId = SESSION;
const workspaceId: WorkspaceId = WORKSPACE;

afterEach(cleanup);

describe('ArtifactNewMenu folder item', () => {
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

  const openMenu = () => {
    render(<ArtifactNewMenu sessionId={sessionId} onImportWireframe={vi.fn()} />);
    fireEvent.click(screen.getByTestId('artifact-new'));
  };

  it('shows the artifacts folder from the New menu, with no icon button in the header', () => {
    openMenu();

    expect(screen.queryByRole('button', { name: 'Show in Finder' })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: /Show in Finder/ }));

    expect(openSpy).toHaveBeenCalledWith({ workspaceSlug: 'harborline' });
  });

  it('is disabled while the workspace is not known', () => {
    useAppStore.setState({ workspaces: [] });
    openMenu();

    expect(
      screen.getByRole('menuitem', { name: /Show in Finder/ }).getAttribute('aria-disabled'),
    ).toBe('true');
  });
});
