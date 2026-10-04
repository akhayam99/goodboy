// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../inbox/useInboxRecords', () => ({
  useInboxRecords: () => ({ records: [], isLoading: false, connected: ['linear'] }),
}));
vi.mock('../../../integrations/hooks/useWorkspaceIssueLookup', () => ({
  useWorkspaceIssueLookup: () => ({
    loadingProviders: [],
    settled: {
      hits: [
        {
          candidate: {
            provider: 'linear',
            externalId: 'lin-400',
            identifier: 'HBL-400',
            url: 'https://linear.app/harborline/issue/HBL-400',
            title: 'Payments revamp',
          },
          record: { stateLabel: 'Ongoing', updatedAt: '2026-10-02T09:00:00.000Z' },
        },
      ],
    },
  }),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { IsoDateTime, ProjectId, SessionId } from '@goodboy/types';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { LinkWorkPanel } from './LinkWorkPanel';

const workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const project = aProject({
  id: 'p-payments' as ProjectId,
  workspaceId: workspace.id,
  name: 'payments-api',
  kind: 'repo',
});
const session = aSession({
  id: 's-revamp' as SessionId,
  workspaceId: workspace.id,
  goal: 'Split the payout service',
});

const TASK = {
  provider: 'linear' as const,
  externalId: 'lin-400',
  identifier: 'HBL-400',
  url: 'https://linear.app/harborline/issue/HBL-400',
  title: 'Payments revamp',
  createdAt: '2026-10-02T09:00:00.000Z' as IsoDateTime,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaces: [workspace],
    projects: [project],
    sessions: [session],
    sessionExternalTasks: {},
  });
  await useAppStore.getState().linkSessionExternalTask(session.id, TASK);
});

afterEach(cleanup);

const linksOf = () =>
  (useAppStore.getState().sessionExternalTasks[session.id] ?? []).map(
    (task) => `${task.identifier}:${task.scope ?? 'session'}`,
  );

const mountPanel = () => {
  const onLinked = vi.fn();
  render(<LinkWorkPanel session={session} onLinked={onLinked} onClose={() => undefined} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Search work to link' }), {
    target: { value: 'Payments' },
  });
  return { onLinked };
};

const option = () => screen.getByRole('option', { name: 'Payments revamp (HBL-400)' });

const preview = () => within(screen.getByLabelText('Link preview'));

describe('LinkWorkPanel on a task already linked to the session', () => {
  it('lists the task with the scope it already has', () => {
    mountPanel();

    expect(option().textContent).toContain('Linked to this session');
  });

  it('never offers a second session link of the same task', async () => {
    const { onLinked } = mountPanel();

    expect(preview().getByText(/Linked to this session already/).textContent).not.toContain('Pick');
    const button = preview().getByRole('button', { name: 'Link HBL-400' });
    expect(button.hasAttribute('disabled')).toBe(true);
    await act(async () => {
      fireEvent.click(option());
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    });

    expect(linksOf()).toEqual(['HBL-400:session']);
    expect(onLinked).not.toHaveBeenCalled();
  });

  it('offers no branch tab', () => {
    mountPanel();

    expect(screen.queryByRole('tab', { name: /This branch/ })).toBeNull();
  });
});
