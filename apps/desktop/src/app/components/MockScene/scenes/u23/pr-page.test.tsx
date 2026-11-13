// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { findSectionRow, sectionNames } from '../../../../../test/branchRail';
import { U23_PR_PAGE_SCENES } from './pr-page';
import { PrPageScene } from './PrPageScene';
import { QUEUE_ITEMS, SESSION_ID } from '../resolveSeed';
import { prPageGhStdout, prPageHandlers, prPageUnpushedOf } from './prPageSeed';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  answerWith({ behind: 3 });
});

afterEach(cleanup);

type SceneName = keyof typeof U23_PR_PAGE_SCENES;

const draw = ({ name }: { readonly name: SceneName }) => {
  const Scene = U23_PR_PAGE_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

type AnswerParams = {
  readonly behind: number;
  readonly unpushed?: number;
  readonly isRebasing?: boolean;
};

const answerWith = ({ behind, unpushed = 0, isRebasing = false }: AnswerParams): void => {
  const handlers = prPageHandlers({ behind, unpushed, isRebasing });
  vi.mocked(invoke).mockImplementation(async (command: string, args?: unknown) => {
    if (command === 'gh_run') {
      return { stdout: prPageGhStdout({ payload: args }), stderr: '', exitCode: 0 };
    }
    return handlers[command]?.(undefined) ?? new Promise<never>(() => undefined);
  });
};

const properties = (): HTMLElement => screen.getByRole('group', { name: 'Properties' });

type RowParams = {
  readonly id: string;
};

const rowText = ({ id }: RowParams): string =>
  document.querySelector(`[data-merge-box] [data-testid="merge-row-${id}"]`)?.textContent ?? '';

const verdictText = (): string =>
  document.querySelector('[data-merge-box] [data-verdict]')?.textContent ?? '';

const boxText = (): string => document.querySelector('[data-merge-box]')?.textContent ?? '';

describe('the pull request page scenes', () => {
  it('registers the ten scenes of the plan', () => {
    expect(Object.keys(U23_PR_PAGE_SCENES).sort()).toEqual([
      'branch-pr-activity',
      'branch-pr-draft',
      'branch-pr-editing',
      'branch-pr-github',
      'branch-pr-merge-blocked',
      'branch-pr-merge-methods',
      'branch-pr-merged',
      'branch-pr-narrow',
      'branch-pr-none',
      'branch-pr-rebasing',
    ]);
  });

  it('branch-pr-rebasing shows the open pull request, not the create form', async () => {
    answerWith({ behind: 3, isRebasing: true });
    draw({ name: 'branch-pr-rebasing' });

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Stop retried webhooks posting a second credit',
      }),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Create pull request' })).toBeNull();
    expect(screen.queryByRole('tablist', { name: 'Opens as' })).toBeNull();
  });

  it('branch-pr-github leads with the Overview tab and its title as the one heading', async () => {
    draw({ name: 'branch-pr-github' });

    expect((await findSectionRow(/^Overview/)).getAttribute('aria-selected')).toBe('true');
    expect(sectionNames()[0]).toBe('Overview');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Stop retried webhooks posting a second credit',
    );
  });

  it('branch-pr-github ranks what blocks the merge in one box, people and links on the side', async () => {
    draw({ name: 'branch-pr-github' });
    await screen.findByRole('group', { name: 'Properties' });
    const side = within(properties());

    await waitFor(() => expect(rowText({ id: 'checks' })).toContain('1 check failing'));
    expect(rowText({ id: 'checks' })).toContain('lint');
    expect(rowText({ id: 'review' })).toContain('Changes requested');
    expect(verdictText()).toContain('Not ready to merge');
    expect(rowText({ id: 'branch' })).toContain('3 commits behind main');
    const order = [
      ...document.querySelectorAll('[data-merge-box] [data-testid^="merge-row-"]'),
    ].map((row) => row.getAttribute('data-testid'));
    expect(order).toEqual(['merge-row-checks', 'merge-row-review', 'merge-row-branch']);
    expect(side.getByText('#412')).toBeDefined();
    expect(side.getByText('kenji-w')).toBeDefined();
    expect(side.queryByRole('region', { name: 'Base' })).toBeNull();
    expect(side.queryByRole('region', { name: 'Readiness' })).toBeNull();
    expect(side.queryByRole('button', { name: /Rebase/ })).toBeNull();
    expect(side.queryByRole('region', { name: 'Merge status' })).toBeNull();
    expect(side.queryByRole('region', { name: 'Files changed' })).toBeNull();
  });

  it('branch-pr-github shows the description with Edit beside its heading', async () => {
    draw({ name: 'branch-pr-github' });

    const description = await screen.findByRole('region', { name: 'Description' });
    expect(within(description).getByRole('button', { name: 'Edit' })).toBeDefined();
    expect(within(description).getByText(/guard keyed on the delivery id/)).toBeDefined();
  });

  it('branch-pr-github lists the activity oldest first, with the opening on top', async () => {
    draw({ name: 'branch-pr-github' });

    const activity = await screen.findByRole('region', { name: 'Activity' });
    const rows = within(activity).getAllByRole('listitem');
    expect(rows[0]?.textContent).toMatch(/nadia-p opened this pull request/);
    expect(within(activity).getByText(/omar-t/)).toBeDefined();
    expect(within(activity).getByText(/asked for changes/)).toBeDefined();
    expect(within(activity).getByRole('button', { name: /Open checks/ })).toBeDefined();
  });

  it('branch-pr-activity gives each review app one row with its verdict, filtered under Bots', async () => {
    draw({ name: 'branch-pr-activity' });

    const activity = await screen.findByRole('region', { name: 'Activity' });
    await waitFor(() => expect(activity.querySelectorAll('[data-activity="bot"]')).toHaveLength(2));
    const [lint, review] = [...activity.querySelectorAll('[data-activity="bot"]')];
    expect(lint?.textContent).toContain('cascadia-lint[bot]');
    expect(lint?.textContent).toContain('1 issue');
    expect(review?.textContent).toContain('acme-review');
    expect(within(activity).queryByText(/acme-review commented/)).toBeNull();
    expect(activity.querySelectorAll('[data-activity="review"]')).toHaveLength(1);

    const filter = within(activity).getByRole('tablist', { name: 'Activity filter' });
    expect(within(filter).queryByRole('tab', { name: /Pushes|Checks/ })).toBeNull();
    expect(
      within(filter)
        .getAllByRole('tab')
        .map((tab) => tab.textContent?.replace(/\d+$/, '')),
    ).toEqual(['All', 'People', 'Bots']);
    fireEvent.click(within(filter).getByRole('tab', { name: /Bots/ }));
    expect(
      [...activity.querySelectorAll('[data-activity]')].map((row) =>
        row.getAttribute('data-activity'),
      ),
    ).toEqual(['bot', 'bot']);
  });

  it('branch-pr-activity counts the open threads the same in the merge box and the activity', async () => {
    draw({ name: 'branch-pr-activity' });

    const activity = await screen.findByRole('region', { name: 'Activity' });
    await waitFor(() => expect(rowText({ id: 'comments' })).not.toBe(''));
    const boxWords = rowText({ id: 'comments' });
    const line = activity.querySelector('[data-activity="comments"]')?.textContent ?? '';
    const tab = await findSectionRow(/^Comments/);

    expect(/(\d+) threads? needs? you/.exec(boxWords)?.[1]).toBe(
      /(\d+) needs? you/.exec(line)?.[1],
    );
    expect(/(\d+) open threads?/.exec(boxWords)?.[1]).toBe(
      /(\d+)$/.exec(tab.textContent ?? '')?.[1],
    );
  });

  it('branch-pr-activity counts one thread left open as 1 on the Comments tab, the activity and the merge box', async () => {
    draw({ name: 'branch-pr-activity' });
    await screen.findByRole('region', { name: 'Activity' });
    const [first] = QUEUE_ITEMS;
    if (first === undefined) {
      throw new Error('the resolve seed has queue items');
    }
    const leftOpen = { item: first.item, thread: { ...first.thread, stage: 'parked' as const } };

    act(() => {
      store.setState({
        sessionResolveQueueItems: { [SESSION_ID]: [leftOpen] },
        sessionResolveThreads: { [SESSION_ID]: [leftOpen.thread] },
      });
    });

    await waitFor(() => expect(rowText({ id: 'comments' })).toContain('1 open thread'));
    expect(rowText({ id: 'comments' })).not.toContain('need you');
    expect(document.querySelector('[data-activity="comments"]')?.textContent ?? '').toContain(
      '1 open',
    );
    expect((await findSectionRow(/^Comments/)).textContent).toMatch(/Comments1$/);
  });

  it('branch-pr-draft says the draft is not open for review yet', async () => {
    draw({ name: 'branch-pr-draft' });

    const side = within(await screen.findByRole('group', { name: 'Properties' }));
    expect(document.querySelector('[data-slot="branch-state"]')?.textContent).toBe('Draft');
    expect(side.getByText('Nobody asked yet')).toBeDefined();
  });

  it('branch-pr-editing opens the title and the description editors', async () => {
    draw({ name: 'branch-pr-editing' });

    expect(await screen.findByRole('textbox', { name: 'Pull request title' })).toBeDefined();
    expect(await screen.findByRole('textbox', { name: 'Description, markdown' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined();
    expect(screen.getByText('Enter saves, Esc cancels')).toBeDefined();
  });

  it('branch-pr-none offers the create form with the card, Opens as and one Create', async () => {
    draw({ name: 'branch-pr-none' });

    expect(await screen.findByRole('textbox', { name: 'Pull request title' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Write with Scribe' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create pull request' })).toBeDefined();
    expect(screen.getByRole('tablist', { name: 'Opens as' })).toBeDefined();
    expect(screen.queryByRole('switch', { name: 'Open as draft' })).toBeNull();
  });

  it('branch-pr-none picks the default base branch instead of an empty list', async () => {
    draw({ name: 'branch-pr-none' });

    await screen.findByRole('textbox', { name: 'Pull request title' });
    const base = await screen.findByRole('combobox', { name: 'Branch' });
    await waitFor(() => expect(base.textContent).toContain('main'));
    expect(base.textContent).not.toContain('[]');
  });

  it('leads with the push and blocks the merge while commits are not pushed', async () => {
    answerWith({ behind: 0, unpushed: 3 });
    draw({ name: 'branch-pr-merge-methods' });

    await waitFor(() =>
      expect(
        document.querySelector('[data-branch-primary]')?.getAttribute('data-branch-primary'),
      ).toBe('diff.push'),
    );
    await waitFor(() => expect(rowText({ id: 'unpushed' })).toContain('3 commits not pushed'));
    expect(verdictText()).toContain('Not ready to merge');
    expect(document.querySelector('[data-branch-secondary]')).toBeNull();
  });

  it('opens the merge again once the push went through', async () => {
    answerWith({ behind: 0, unpushed: 3 });
    draw({ name: 'branch-pr-merge-methods' });
    const push = await waitFor(() => {
      const button = document.querySelector('[data-branch-primary="diff.push"]');
      if (button === null) {
        throw new Error('no Push in the header yet');
      }
      return button;
    });

    answerWith({ behind: 0 });
    store.setState({ pushBranch: async () => ({ ok: true }) });
    fireEvent.click(push);

    await waitFor(() => expect(boxText()).not.toContain('not pushed'));
    expect(document.querySelector('[data-branch-primary="diff.push"]')).toBeNull();
  });

  it('branch-pr-merge-blocked says in Readiness why Merge cannot run', async () => {
    answerWith({ behind: 0 });
    draw({ name: 'branch-pr-merge-blocked' });

    await waitFor(() => expect(rowText({ id: 'checks' })).toContain('lint, contract tests'));
    await waitFor(() =>
      expect(
        document.querySelector('[data-branch-primary]')?.getAttribute('data-branch-primary'),
      ).toBe('step.checks'),
    );
    expect(document.querySelector('[data-branch-primary]')?.textContent).toBe('Fix checks');
    expect(
      screen.queryByRole('button', { name: /^(Squash and merge|Rebase and merge|Merge commit)/ }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Branch actions' }));
    expect(screen.getByRole('menuitem', { name: /Merge/ }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  it('branch-pr-merge-methods asks for a method and disables the one the repository forbids', async () => {
    answerWith({ behind: 0 });
    draw({ name: 'branch-pr-merge-methods' });

    const group = await screen.findByRole('group', { name: /Merge .* into main/ });
    const methods = within(group).getByRole('tablist', { name: 'Merge method' });
    expect(within(methods).getByRole('tab', { name: /Squash and merge/ })).toBeDefined();
    const forbidden = within(methods).getByRole('tab', {
      name: /Merge commit/,
    }) as HTMLButtonElement;
    expect(forbidden.disabled).toBe(true);
    expect(forbidden.textContent).toContain('Turned off in payments-api');
    expect(
      within(methods)
        .getByRole('tab', { name: /Squash and merge/ })
        .getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('branch-pr-narrow keeps the properties in the page for a narrow pane', async () => {
    draw({ name: 'branch-pr-narrow' });

    expect(await screen.findByRole('group', { name: 'Properties' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Description' })).toBeDefined();
  });

  it('branch-pr-merged says it merged into main and offers no merge', async () => {
    draw({ name: 'branch-pr-merged' });

    await screen.findByRole('group', { name: 'Properties' });
    expect(document.querySelector('[data-slot="branch-state"]')?.getAttribute('data-tone')).toBe(
      'merged',
    );
    expect(
      within(screen.getByRole('region', { name: 'Activity' })).getByText(
        /merged this pull request/,
      ),
    ).toBeDefined();
    expect(
      screen.queryByRole('button', { name: /^(Squash and merge|Rebase and merge|Merge commit)/ }),
    ).toBeNull();
  });
});

describe('the branch page of a branch with no pull request', () => {
  const header = (): HTMLElement => {
    const line = document.querySelector<HTMLElement>('[data-branch-start-line]');
    if (line === null) {
      throw new Error('the header has a branch line');
    }
    return line;
  };

  it('names the branch, says it is behind and leads with Rebase, keeping Create secondary', async () => {
    draw({ name: 'branch-pr-none' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'hl/fix-duplicate-credit' }),
    ).toBeDefined();
    expect(header().textContent).toBe('Up to date with origin3 behind main');
    await waitFor(() =>
      expect(
        document.querySelector('[data-branch-primary]')?.getAttribute('data-branch-primary'),
      ).toBe('diff.rebase'),
    );
    const create = screen.getByRole('button', { name: 'Create pull request' });
    expect(create.getAttribute('data-create-submit')).toBe('secondary');
    expect(screen.queryByRole('region', { name: 'Merge status' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Summary' })).toBeNull();
  });

  it('says 3 not pushed, never up to date, when the seed holds three unpushed commits', async () => {
    answerWith({ behind: 0, unpushed: prPageUnpushedOf({ variant: 'none-unpushed' }) });
    const Scene = () => <PrPageScene variant="none-unpushed" />;
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    await waitFor(() => expect(header().textContent).toContain('3 not pushed'));
    expect(header().textContent).not.toContain('Up to date with origin');
    await waitFor(() =>
      expect(
        document.querySelector('[data-create-submit]')?.getAttribute('data-create-submit'),
      ).toBe('primary'),
    );
    expect(document.querySelector('[data-branch-primary="diff.push"]')).toBeNull();
    expect(document.querySelectorAll('button[data-variant="primary"]')).toHaveLength(1);
  });

  it('makes Create the one primary once the branch is pushed and up to date', async () => {
    answerWith({ behind: 0 });
    draw({ name: 'branch-pr-none' });

    const create = await screen.findByRole('button', { name: 'Create pull request' });
    expect(create.getAttribute('data-create-submit')).toBe('primary');
    expect(document.querySelector('[data-branch-primary]')).toBeNull();
    expect(header().getAttribute('data-branch-start-line')).toBe('pushed');
  });

  it('prefills the title from the commits instead of the session goal', async () => {
    answerWith({ behind: 0 });
    draw({ name: 'branch-pr-none' });

    const title = await screen.findByRole('textbox', { name: 'Pull request title' });
    await waitFor(() =>
      expect(title instanceof HTMLInputElement ? title.value : '').toContain(
        'Keep the processor event id on every credit row',
      ),
    );
    expect(screen.queryByRole('region', { name: 'In this branch' })).toBeNull();
  });

  it('hides the form while a rebase is stopped and lists the conflicts instead', async () => {
    answerWith({ behind: 3, isRebasing: true });
    draw({ name: 'branch-pr-none' });

    expect(await screen.findByRole('region', { name: 'Conflicts' })).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Pull request title' })).toBeNull();
    expect(screen.queryByRole('button', { name: /create pull request/i })).toBeNull();
    expect(header().textContent).toContain('Rebasing');
  });

  it('opens the pull request from the shown branch, not the branch the session writes to', async () => {
    answerWith({ behind: 0 });
    draw({ name: 'branch-pr-rebasing' });
    await screen.findByRole('heading', { level: 1 });
    const shown = store.getState().sessionProjectMounts[SESSION_ID]?.[0];
    const active = store.getState().sessionActiveMount[SESSION_ID];
    if (shown === undefined || active === undefined || shown.mountId === active) {
      throw new Error('the scene shows a branch that is not the write destination');
    }
    const github = store.getState().mountGithub[shown.mountId];
    if (github === undefined) {
      throw new Error('the scene seeds the shown branch on GitHub');
    }
    const createPrForSession = vi.fn(async () => ({ number: 319, url: null }));
    act(() =>
      store.setState((state) => ({
        createPrForSession,
        mountGithub: { ...state.mountGithub, [shown.mountId]: { ...github, pr: null, prs: [] } },
      })),
    );
    answerWith({ behind: 0 });

    const create = await screen.findByRole('button', { name: 'Create pull request' });
    fireEvent.click(create);

    await waitFor(() => expect(createPrForSession).toHaveBeenCalledTimes(1));
    expect(createPrForSession).toHaveBeenCalledWith(
      expect.objectContaining({ mountId: shown.mountId }),
    );
  });
});
