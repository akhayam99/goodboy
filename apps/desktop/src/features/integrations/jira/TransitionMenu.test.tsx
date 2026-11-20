// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { jiraListTransitions } from './client';
import type { ReportErrorParams } from '../../../store/slices/notifications/reportError';

const h = vi.hoisted(() => ({
  config: {
    siteUrl: 'https://acme.atlassian.net',
    email: 'grace@acme.com',
    projectKey: 'ENG',
  } as unknown,
  reportError: vi.fn(async (_params: ReportErrorParams) => undefined),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('./useJiraConfig', () => ({ useJiraConfig: () => h.config }));
vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  jiraListTransitions: vi.fn(async () => []),
}));

import { tooltipTextOf } from '../../../__tests__/helpers/tooltip';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../store/storyHarness';
import { TransitionMenu } from './TransitionMenu';

const listTransitions = vi.mocked(jiraListTransitions);

const WORKSPACE = 'workspace-1' as WorkspaceId;

const mount = ({ onTransition }: { onTransition: (id: string) => Promise<void> }) =>
  render(
    <TransitionMenu
      issueKey="ENG-142"
      workspaceId={WORKSPACE}
      onTransition={onTransition}
      state={{ label: 'To Do', tone: 'neutral' }}
    />,
  );

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  vi.clearAllMocks();
  await resetStoryStore();
  useAppStore.setState({ reportError: h.reportError });
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

    fireEvent.click(await screen.findByRole('button', { name: /move this issue/ }));

    expect(listTransitions).toHaveBeenCalledWith(
      expect.objectContaining({ issueKey: 'ENG-142', siteUrl: 'https://acme.atlassian.net' }),
    );
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(screen.getByRole('menuitem', { name: /Start progress/ })).toBeDefined();
  });

  it('stays visible and disabled with a readable reason when the workflow cannot be read', async () => {
    listTransitions.mockRejectedValue(new Error('403 Forbidden'));
    mount({ onTransition: vi.fn(async () => {}) });

    const trigger = await screen.findByRole('button', { name: /move this issue/ });
    await waitFor(() => expect(trigger.getAttribute('aria-disabled')).toBe('true'));

    expect(tooltipTextOf({ element: trigger })).toContain('403 Forbidden');
    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('logs what Jira refused with a Retry that sends the same move, and draws no red line', async () => {
    listTransitions.mockResolvedValue([
      { id: '31', name: 'Ready for review', to: null, hasScreen: false },
    ]);
    const onTransition = vi.fn(async (_id: string) => undefined);
    onTransition.mockRejectedValueOnce(new Error('Field "Reviewer" is required'));
    mount({ onTransition });

    fireEvent.click(await screen.findByRole('button', { name: /move this issue/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ready for review' }));

    await waitFor(() => expect(h.reportError).toHaveBeenCalledOnce());
    const reported = h.reportError.mock.calls[0]?.[0];
    expect(reported?.title).toBe("Couldn't move ENG-142 to Ready for review");
    expect(screen.queryByRole('alert')).toBeNull();
    expect(await reported?.retry?.()).toBe(true);
    expect(onTransition).toHaveBeenLastCalledWith('31');
    expect(onTransition).toHaveBeenCalledTimes(2);
  });

  it('closes only after Jira accepts the move, and names where each move goes', async () => {
    listTransitions.mockResolvedValue([
      { id: '11', name: 'Start progress', to: { id: '3', name: 'In Progress' }, hasScreen: false },
      { id: '31', name: 'Ready for review', to: null, hasScreen: true },
    ]);
    let accept: () => void = () => undefined;
    const onTransition = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          accept = resolve;
        }),
    );
    mount({ onTransition });

    fireEvent.click(await screen.findByRole('button', { name: /move this issue/ }));
    const menu = screen.getByRole('menu', { name: 'Move this issue' });
    expect(screen.getByRole('menuitem', { name: /Start progress/ }).textContent).toContain(
      'In Progress',
    );
    expect(screen.getByRole('menuitem', { name: /Ready for review/ }).textContent).toContain(
      'extra fields',
    );
    expect(document.activeElement?.textContent).toContain('Start progress');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toContain('Ready for review');

    fireEvent.click(screen.getByRole('menuitem', { name: /Start progress/ }));

    expect(onTransition).toHaveBeenCalledWith('11');
    expect(
      screen.getByRole('menuitem', { name: /Ready for review/ }).getAttribute('aria-disabled'),
    ).toBe('true');
    accept();
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });
});
