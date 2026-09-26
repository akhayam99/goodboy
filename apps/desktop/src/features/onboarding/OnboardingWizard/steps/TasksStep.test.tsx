// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

vi.mock('../../../integrations/formBodies', () => ({
  FORM_BODIES: {
    linear: () => <div data-testid="linear-form" />,
    jira: () => <div data-testid="jira-form" />,
  },
}));

import { TasksStep } from './TasksStep';

afterEach(cleanup);

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

describe('TasksStep', () => {
  it('greys out GitHub Issues with a way back when the code host was skipped', () => {
    const onBackToCodeHost = vi.fn();
    render(
      <TasksStep
        workspaceId={WORKSPACE_ID}
        issueHost={null}
        preferredHost="github"
        connected={{ linear: false, jira: false }}
        onBackToCodeHost={onBackToCodeHost}
      />,
    );
    expect(screen.getByText('Needs GitHub, which you skipped.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Code host' }));
    expect(onBackToCodeHost).toHaveBeenCalledOnce();
  });

  it('shows the issues of a connected code host as ready', () => {
    render(
      <TasksStep
        workspaceId={WORKSPACE_ID}
        issueHost="gitlab"
        preferredHost="gitlab"
        connected={{ linear: false, jira: false }}
        onBackToCodeHost={null}
      />,
    );
    expect(screen.getByText('GitLab Issues')).toBeDefined();
    expect(screen.getAllByText('Ready')).toHaveLength(1);
  });

  it('connects a task manager inside its own row', () => {
    render(
      <TasksStep
        workspaceId={WORKSPACE_ID}
        issueHost={null}
        preferredHost={null}
        connected={{ linear: false, jira: true }}
        onBackToCodeHost={null}
      />,
    );
    expect(screen.queryByText(/Issues$/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Connect Linear' }));
    expect(screen.getByTestId('linear-form')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Connect Jira' })).toBeNull();
  });
});
