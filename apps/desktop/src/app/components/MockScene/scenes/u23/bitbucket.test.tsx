// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('../../../../../shared/lib/editor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../../shared/lib/editor')>()),
  openUrl: vi.fn(async () => undefined),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { openUrl } from '../../../../../shared/lib/editor';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { SESSION } from '../resolveSeed';
import { BitbucketPageScene } from './BitbucketPageScene';
import { U23_BITBUCKET_SCENES } from './bitbucket';
import { bitbucketPageHandlers, type BitbucketPageVariant } from './bitbucketSeed';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const MEMBERS = [
  {
    uuid: '{kenji-w-uuid}',
    accountId: null,
    nickname: 'kenji-w',
    displayName: 'Kenji Watanabe',
    avatarUrl: null,
  },
  {
    uuid: '{omar-t-uuid}',
    accountId: null,
    nickname: 'omar-t',
    displayName: 'Omar Tran',
    avatarUrl: null,
  },
  {
    uuid: '{rio-k-uuid}',
    accountId: null,
    nickname: 'rio-k',
    displayName: 'Rio Kato',
    avatarUrl: null,
  },
];

const answer = async (command: string): Promise<unknown> => {
  if (command === 'bitbucket_search_workspace_members') {
    return MEMBERS;
  }
  const handler = bitbucketPageHandlers()[command];
  return handler === undefined ? new Promise<never>(() => undefined) : handler(undefined);
};

type StoreState = ReturnType<StoryStore['getState']>;

type Stubs = {
  readonly editPr: ReturnType<typeof vi.fn<StoreState['editPr']>>;
  readonly requestReview: ReturnType<typeof vi.fn<StoreState['requestReview']>>;
  readonly mergePr: ReturnType<typeof vi.fn<StoreState['mergePr']>>;
  readonly closePr: ReturnType<typeof vi.fn<StoreState['closePr']>>;
};

let stubs: Stubs;

beforeEach(async () => {
  await resetStoryStore();
  vi.mocked(invoke).mockImplementation(answer);
  vi.mocked(openUrl).mockClear();
  stubs = {
    editPr: vi.fn<StoreState['editPr']>(async () => undefined),
    requestReview: vi.fn<StoreState['requestReview']>(async () => undefined),
    mergePr: vi.fn<StoreState['mergePr']>(async () => undefined),
    closePr: vi.fn<StoreState['closePr']>(async () => undefined),
  };
});

afterEach(cleanup);

const show = async (variant: BitbucketPageVariant = 'pr') => {
  render(
    <ToastProvider>
      <BitbucketPageScene variant={variant} />
    </ToastProvider>,
  );
  await screen.findByRole('tab', { name: /^Pull request/ });
  act(() => {
    useAppStore.setState(stubs);
  });
};

const properties = (): HTMLElement => screen.getByRole('complementary', { name: 'Properties' });

const openOverflow = async (): Promise<void> => {
  fireEvent.click(await screen.findByRole('button', { name: 'Branch actions' }));
};

describe('the Bitbucket scenes', () => {
  it('registers the scenes of the plan', () => {
    expect(Object.keys(U23_BITBUCKET_SCENES).sort()).toEqual([
      'branch-checks-bitbucket-rows',
      'branch-pr-bitbucket',
      'branch-pr-bitbucket-denied',
      'branch-pr-bitbucket-merge',
      'session-marks-bitbucket',
    ]);
  });

  it('leads with the Pull request tab and the title as the one heading', async () => {
    await show();

    expect(screen.getByRole('tab', { name: /^Pull request/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Stop retried webhooks posting a second credit',
    );
  });

  it('reads the status, reviewers, checks, branch and files in the properties', async () => {
    await show();
    const side = within(properties());

    expect(side.getByText('Blocked: 1 check failing')).toBeDefined();
    expect(side.getByText('Bitbucket checks this when you merge')).toBeDefined();
    expect(side.getByText('kenji-w')).toBeDefined();
    expect(side.getByText('Approved')).toBeDefined();
    expect(side.getByText('Changes requested')).toBeDefined();
    expect(side.getByText('Pending')).toBeDefined();
    expect(side.getByText('hl/fix-duplicate-credit')).toBeDefined();
    expect(side.getByText('5 files')).toBeDefined();
  });

  it('uses the words of the host and none of GitHub', async () => {
    await show();

    expect(screen.queryByText(/GitHub/)).toBeNull();
    expect(screen.getByRole('region', { name: 'Activity' }).textContent).toMatch(
      /nadia-p opened this pull request/,
    );
  });
});

describe('the Pull request tab on Bitbucket, controls', () => {
  it('leaves out the draft and reopen controls instead of disabling them', async () => {
    await show();

    expect(screen.queryByRole('button', { name: /ready for review|draft/i })).toBeNull();
    await openOverflow();
    const menu = await screen.findByRole('menu', { name: 'Branch actions' });
    const labels = within(menu)
      .getAllByRole('menuitem')
      .map((item) => item.textContent);
    expect(labels.some((label) => /draft/i.test(label ?? ''))).toBe(false);
    expect(labels.some((label) => /Reopen/.test(label ?? ''))).toBe(false);
    expect(labels).toContain('Open on Bitbucket');
    expect(labels).toContain('Close pull request');
  });

  it('edits the title and saves it through the host', async () => {
    await show();

    fireEvent.click(screen.getByTitle('Edit title (E)'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Pull request title' }), {
      target: { value: 'Key the guard on the event id' },
    });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Pull request title' }), {
      key: 'Enter',
    });

    await waitFor(() => expect(stubs.editPr).toHaveBeenCalledTimes(1));
    expect(stubs.editPr).toHaveBeenCalledWith(SESSION.id, 42, {
      title: 'Key the guard on the event id',
      isQuiet: true,
      mountId: expect.any(String),
    });
  });

  it('edits the description and says it was saved to Bitbucket', async () => {
    await show();

    const description = screen.getByRole('region', { name: 'Description' });
    fireEvent.click(within(description).getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Description, markdown' }), {
      target: { value: 'Retried deliveries no longer post a second credit.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(stubs.editPr).toHaveBeenCalledTimes(1));
    expect(stubs.editPr).toHaveBeenCalledWith(SESSION.id, 42, {
      body: 'Retried deliveries no longer post a second credit.',
      isQuiet: true,
      mountId: expect.any(String),
    });
    expect(await screen.findByText('Saved to Bitbucket')).toBeDefined();
  });

  it('searches the workspace members and requests the one picked', async () => {
    await show();

    fireEvent.click(within(properties()).getByRole('button', { name: 'Request review' }));

    expect(await screen.findByText('rio-k')).toBeDefined();
    expect(screen.getAllByText('kenji-w')).toHaveLength(1);
    fireEvent.click(screen.getByText('rio-k'));

    await waitFor(() => expect(stubs.requestReview).toHaveBeenCalledTimes(1));
    expect(stubs.requestReview).toHaveBeenCalledWith(SESSION.id, 42, ['rio-k']);
  });
});

describe('the Pull request tab on Bitbucket, merge and close', () => {
  it('offers the three strategies, none of them forbidden, and merges with the one chosen', async () => {
    await show('merge');

    const group = await screen.findByRole('group', { name: /Merge .* into main/ });
    const methods = within(group).getByRole('tablist', { name: 'Merge method' });
    const tabs = within(methods).getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs.every((tab) => !(tab as HTMLButtonElement).disabled)).toBe(true);
    expect(within(methods).getByRole('tab', { name: /Squash and merge/ })).toBeDefined();
    expect(within(methods).getByRole('tab', { name: /Merge commit/ })).toBeDefined();
    expect(group.textContent).toContain('Bitbucket checks this when you merge');
    expect(group.textContent).not.toContain('GitHub');

    fireEvent.click(within(methods).getByRole('tab', { name: /Rebase and merge/ }));
    fireEvent.click(within(group).getByRole('button', { name: 'Merge' }));

    await waitFor(() => expect(stubs.mergePr).toHaveBeenCalledTimes(1));
    expect(stubs.mergePr).toHaveBeenCalledWith(SESSION.id, 42, 'rebase');
  });

  it('closes after a confirm that says a declined pull request cannot be reopened', async () => {
    await show();

    await openOverflow();
    fireEvent.click(await screen.findByRole('menuitem', { name: /Close pull request/ }));

    const group = await screen.findByRole('group', { name: /Close #42 without merging/ });
    expect(group.textContent).toContain("Bitbucket can't reopen a declined pull request");
    fireEvent.click(within(group).getByRole('button', { name: 'Close pull request' }));

    await waitFor(() => expect(stubs.closePr).toHaveBeenCalledTimes(1));
    expect(stubs.closePr).toHaveBeenCalledWith(SESSION.id, 42);
  });

  it('shows a declined pull request as closed with no Reopen, Close or Merge', async () => {
    await show('declined');

    const side = within(properties());
    expect(side.getAllByText('Closed').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^Merge/ })).toBeNull();
    await openOverflow();
    const menu = await screen.findByRole('menu', { name: 'Branch actions' });
    const labels = within(menu)
      .getAllByRole('menuitem')
      .map((item) => item.textContent ?? '');
    expect(labels.some((label) => /Reopen|Close pull request/.test(label))).toBe(false);
    expect(labels).toContain('Open on Bitbucket');
  });
});

describe('the Pull request tab on Bitbucket, without a pull request', () => {
  it('says to create it on Bitbucket and opens the new pull request page of the branch', async () => {
    await show('none');

    expect(await screen.findByRole('heading', { name: 'No pull request yet' })).toBeDefined();
    expect(screen.getByText('Create the pull request on Bitbucket, it appears here')).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Pull request title' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create pull request' })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: /Open Bitbucket/ }));
    expect(openUrl).toHaveBeenCalledWith(
      'https://bitbucket.org/harborline/payments-api/pull-requests/new?source=hl%2Ffix-duplicate-credit',
    );
  });
});

describe('the Checks tab on Bitbucket', () => {
  const draw = (name: keyof typeof U23_BITBUCKET_SCENES) => {
    const Scene = U23_BITBUCKET_SCENES[name];
    return render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );
  };

  it('branch-checks-bitbucket-rows lists a row per status', async () => {
    draw('branch-checks-bitbucket-rows');

    expect(await screen.findByText('lint')).toBeDefined();
    for (const name of ['build', 'unit tests', 'contract tests']) {
      expect(screen.getByText(name)).toBeDefined();
    }
    expect(screen.queryByText(/doesn't show Bitbucket checks/)).toBeNull();
    expect(screen.queryByText(/GitHub/)).toBeNull();
  });

  it('branch-pr-bitbucket-denied warns that the token lacks the scope and opens the settings', async () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:open-settings', listener);
    draw('branch-pr-bitbucket-denied');

    expect(await screen.findByText('The API token lacks the pull request scope')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open Bitbucket settings' }));
    expect(listener.mock.calls[0]?.[0]).toMatchObject({
      detail: { scope: 'tools', tool: 'bitbucket' },
    });
    window.removeEventListener('goodboy:open-settings', listener);
  });
});

describe('the session marks scene on Bitbucket', () => {
  const rowOf = (title: string): HTMLElement => screen.getByRole('button', { name: title });

  const markOf = (title: string) => {
    const row = rowOf(title);
    const node = row.querySelector('[role="img"]');
    return {
      tone: row.querySelector('[data-node-tone]')?.getAttribute('data-node-tone'),
      state: node?.getAttribute('data-node-state'),
      words: (node?.getAttribute('aria-label') ?? '').replace(/, unseen$/, ''),
    };
  };

  it.each([
    ['Stop notify-relay retries on a 409', 'danger', 'failed', 'Checks failing'],
    ['Move the ledger export to a queue', 'warning', 'alert', 'Changes requested'],
    ['Paginate the payments list', 'success', 'approved', 'Approved, ready to merge'],
    ['Ship the refund webhook', 'danger', 'failed', 'Checks failing'],
  ] as const)(
    'marks "%s" by what its statuses and reviewers say',
    async (title, tone, state, words) => {
      const Scene = U23_BITBUCKET_SCENES['session-marks-bitbucket'];
      render(
        <ToastProvider>
          <Scene />
        </ToastProvider>,
      );
      await waitFor(() => expect(rowOf(title)).toBeDefined());

      expect(markOf(title)).toEqual({ tone, state, words });
    },
  );
});
