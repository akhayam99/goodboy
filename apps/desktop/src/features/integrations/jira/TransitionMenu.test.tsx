// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { jiraListTransitions } from './client';

const h = vi.hoisted(() => ({
  config: {
    siteUrl: 'https://acme.atlassian.net',
    email: 'grace@acme.com',
    projectKey: 'ENG',
  } as unknown,
}));

vi.mock('./useJiraConfig', () => ({ useJiraConfig: () => h.config }));
vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  jiraListTransitions: vi.fn(async () => []),
}));

import { TransitionMenu } from './TransitionMenu';

const listTransitions = vi.mocked(jiraListTransitions);

const WORKSPACE = 'workspace-1' as WorkspaceId;

const mount = ({ onTransition }: { onTransition: (id: string) => Promise<void> }) =>
  render(<TransitionMenu issueKey="ENG-142" workspaceId={WORKSPACE} onTransition={onTransition} />);

beforeEach(() => {
  vi.clearAllMocks();
  listTransitions.mockResolvedValue([]);
});
afterEach(cleanup);

describe('TransitionMenu', () => {
  it('offers exactly the moves Jira reports for that issue', async () => {
    listTransitions.mockResolvedValue([
      { id: '11', name: 'Start progress', to: { id: '3', name: 'In Progress' }, hasScreen: false },
      { id: '31', name: 'Ready for review', to: { id: '5', name: 'In Review' }, hasScreen: true },
    ]);
    mount({ onTransition: vi.fn(async () => {}) });

    fireEvent.click(await screen.findByRole('button', { name: 'Move' }));

    expect(listTransitions).toHaveBeenCalledWith(
      expect.objectContaining({ issueKey: 'ENG-142', siteUrl: 'https://acme.atlassian.net' }),
    );
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(screen.getByRole('menuitem', { name: /Start progress/ })).toBeDefined();
  });

  it('stays visible and disabled with a readable reason when the workflow cannot be read', async () => {
    listTransitions.mockRejectedValue(new Error('403 Forbidden'));
    mount({ onTransition: vi.fn(async () => {}) });

    const trigger = await screen.findByRole('button', { name: 'Move' });
    await waitFor(() => expect(trigger.getAttribute('aria-disabled')).toBe('true'));

    expect(trigger.getAttribute('title')).toContain('403 Forbidden');
    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('keeps the menu mounted and shows what Jira refused when a move fails', async () => {
    listTransitions.mockResolvedValue([
      { id: '31', name: 'Ready for review', to: null, hasScreen: false },
    ]);
    mount({
      onTransition: vi.fn(async () => {
        throw new Error('Field "Reviewer" is required');
      }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Move' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ready for review' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Reviewer');
    expect(screen.getByRole('menuitem', { name: 'Ready for review' })).toBeDefined();
  });
});
