// @vitest-environment happy-dom

const h = vi.hoisted(() => ({ starred: [] as ReadonlyArray<unknown> }));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    listStarredIssues: vi.fn(async () => h.starred),
    updateStarredIssueSnapshots: vi.fn(async () => undefined),
  }),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { IsoDateTime, StarredIssue, WorkspaceId } from '@goodboy/types';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { pressShortcut } from '../../../../__tests__/helpers/pressKey';
import { InboxStudio } from './index';

const WORKSPACE = aWorkspace({ id: 'workspace-harborline' as WorkspaceId, name: 'Harborline' });

const starred = (
  issue: Pick<StarredIssue, 'provider' | 'externalId' | 'identifier' | 'title'>,
): StarredIssue => ({
  workspaceId: WORKSPACE.id,
  container: null,
  url: `https://example.invalid/${issue.externalId}`,
  state: 'open',
  stateLabel: null,
  starredAt: '2026-09-30T10:00:00.000Z' as IsoDateTime,
  refreshedAt: null,
  ...issue,
});

const STARRED: ReadonlyArray<StarredIssue> = [
  starred({
    provider: 'sentry',
    externalId: 'sentry-3f2',
    identifier: 'PAYMENTS-API-3F2',
    title: 'DuplicateCreditError in applyWebhook',
  }),
  starred({
    provider: 'github',
    externalId: 'payments-api#57',
    identifier: '#57',
    title: 'Retried webhooks post a second credit',
  }),
];

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  h.starred = STARRED;
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    starredIssues: { [WORKSPACE.id]: STARRED },
  });
  stubStoryInvoke({
    sentry_fetch_issue_detail: {
      title: null,
      culprit: null,
      frames: [],
      tags: [],
      breadcrumbs: [],
    },
    sentry_fetch_issue: {
      id: 'sentry-3f2',
      project: null,
      shortId: 'PAYMENTS-API-3F2',
      title: 'DuplicateCreditError in applyWebhook',
      culprit: null,
      level: 'error',
      status: 'unresolved',
      count: '12',
      userCount: 3,
      firstSeen: null,
      lastSeen: null,
      permalink: 'https://example.invalid/sentry-3f2',
      metadata: null,
    },
    sentry_list_code_mappings: [],
    gh_run: { stdout: '', stderr: 'no repository', exitCode: 1 },
  });
});

afterEach(() => {
  cleanup();
});

const keyHints = (): string =>
  screen.getByRole('navigation', { name: 'Filter tasks' }).textContent ?? '';

const selectedKeys = (): ReadonlyArray<string> =>
  Array.from(document.querySelectorAll('[data-inbox-key][data-selected="true"]')).map(
    (row) => row.getAttribute('data-inbox-key') ?? '',
  );

const openRecord = async ({
  key,
  fetchedBy,
}: {
  readonly key: string;
  readonly fetchedBy: string;
}) => {
  render(
    <InboxStudio
      workspaceId={WORKSPACE.id}
      rootPath="/repo"
      initialRecordKey={key}
      onClose={vi.fn()}
    />,
  );
  await waitFor(() =>
    expect(storySpies.tauriInvoke.mock.calls.map(([command]) => command)).toContain(fetchedBy),
  );
  await waitFor(() => expect(selectedKeys()).toEqual([key]));
};

const pressReply = async (): Promise<KeyboardEvent> => {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  const pressed: Array<KeyboardEvent> = [];
  await act(async () => {
    pressed.push(pressShortcut({ id: 'list.reply' }));
  });
  const [event] = pressed;
  if (event === undefined) {
    throw new Error('no key was pressed');
  }
  return event;
};

describe('Reply in the inbox', () => {
  it('is not offered on a Sentry issue, and R does nothing there', async () => {
    await openRecord({ key: 'sentry:error:sentry-3f2', fetchedBy: 'sentry_fetch_issue' });

    expect(keyHints()).toContain('Star');
    expect(keyHints()).not.toContain('Reply');
    const event = await pressReply();
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement?.tagName).not.toBe('TEXTAREA');
  });

  it('is offered on a GitHub issue, and R lands in its composer', async () => {
    await openRecord({ key: 'github:issue:payments-api#57', fetchedBy: 'gh_run' });

    expect(keyHints()).toContain('Reply');
    const event = await pressReply();
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(document.activeElement?.tagName).toBe('TEXTAREA'));
  });
});
