// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Project, ProjectId, WorkspaceId } from '@goodboy/types';
import { NewScriptCard } from './NewScriptCard';

const project = ({ id, name }: { readonly id: string; readonly name: string }) =>
  ({
    id: id as ProjectId,
    workspaceId: 'workspace-1' as WorkspaceId,
    name,
    kind: 'repo',
    rootPath: `/repos/${id}`,
  }) as unknown as Project;

const renderCard = ({
  projects,
  mountPath,
}: {
  readonly projects: ReadonlyArray<Project>;
  readonly mountPath: string | null;
}) =>
  render(
    <NewScriptCard
      name=""
      body=""
      projects={projects}
      projectId={'api' as ProjectId}
      mountPath={mountPath}
      error={null}
      onNameChange={vi.fn()}
      onBodyChange={vi.fn()}
      onProjectChange={vi.fn()}
      onSave={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

afterEach(cleanup);

describe('NewScriptCard', () => {
  it('names the project and the path a single-project script will run in', () => {
    renderCard({ projects: [project({ id: 'api', name: 'API' })], mountPath: '/work/api' });

    expect(screen.getByText('Project')).toBeTruthy();
    expect(screen.getByText('API')).toBeTruthy();
    expect(screen.getByText('Runs in API at /work/api.')).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'New script project' })).toBeNull();
  });

  it('keeps the project selectable when the workspace has more than one', () => {
    renderCard({
      projects: [project({ id: 'api', name: 'API' }), project({ id: 'web', name: 'Web' })],
      mountPath: '/work/api',
    });

    expect(screen.getByRole('combobox', { name: 'New script project' })).toBeTruthy();
    expect(screen.getByText('Runs in API at /work/api.')).toBeTruthy();
  });

  it('says the script has nowhere to run when the project is not mounted', () => {
    renderCard({ projects: [project({ id: 'api', name: 'API' })], mountPath: null });

    expect(
      screen.getByText(
        'API is not mounted in this session yet, so this script has nowhere to run until it is.',
      ),
    ).toBeTruthy();
  });
});
