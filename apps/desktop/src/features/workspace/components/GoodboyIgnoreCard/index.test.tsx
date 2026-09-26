// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Project, ProjectId, WorkspaceId } from '@goodboy/types';

const WORKSPACE_ID = 'ws-1' as WorkspaceId;

const h = vi.hoisted(() => ({ saveGoodboyIgnore: vi.fn(async () => undefined) }));

const pendingProject = (id: string): Project =>
  ({
    id: id as ProjectId,
    workspaceId: WORKSPACE_ID,
    name: id,
    rootPath: `/code/${id}`,
    kind: 'repo',
    goodboyIgnoreCheckedAt: '2026-09-25T00:00:00.000Z',
  }) as Project;

const projectsRef = { value: [pendingProject('acme'), pendingProject('cascadia')] };

vi.mock('../../../../store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({ projects: projectsRef.value, saveGoodboyIgnore: h.saveGoodboyIgnore }),
}));

import { GoodboyIgnoreCard } from './index';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  projectsRef.value = [pendingProject('acme'), pendingProject('cascadia')];
});

describe('GoodboyIgnoreCard', () => {
  it('asks the question once for every unanswered project', () => {
    render(<GoodboyIgnoreCard workspaceId={WORKSPACE_ID} />);

    expect(screen.getByText("Git doesn't ignore .goodboy in 2 projects")).toBeDefined();
    expect(screen.getByText('Save for 2 projects')).toBeDefined();
  });

  it('saves this-mac by default for every pending project, then hides the card', async () => {
    render(<GoodboyIgnoreCard workspaceId={WORKSPACE_ID} />);

    fireEvent.click(screen.getByText('Save for 2 projects'));

    await waitFor(() =>
      expect(screen.queryByText("Git doesn't ignore .goodboy in 2 projects")).toBeNull(),
    );
    expect(h.saveGoodboyIgnore).toHaveBeenCalledWith({ projectId: 'acme', mode: 'this-mac' });
    expect(h.saveGoodboyIgnore).toHaveBeenCalledWith({ projectId: 'cascadia', mode: 'this-mac' });
  });

  it('hides the card without saving when choosing per project', () => {
    render(<GoodboyIgnoreCard workspaceId={WORKSPACE_ID} />);

    fireEvent.click(screen.getByText('Choose per project'));

    expect(h.saveGoodboyIgnore).not.toHaveBeenCalled();
    expect(screen.queryByText("Git doesn't ignore .goodboy in 2 projects")).toBeNull();
  });

  it('renders nothing once every project already has an answer', () => {
    projectsRef.value = [];
    const { container } = render(<GoodboyIgnoreCard workspaceId={WORKSPACE_ID} />);

    expect(container.firstChild).toBeNull();
  });
});
