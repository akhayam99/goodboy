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
import { SESSION_ID } from '../resolveSeed';
import { prPageGhStdout, prPageHandlers } from './prPageSeed';

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
  readonly isRebasing?: boolean;
};

const answerWith = ({ behind, isRebasing = false }: AnswerParams): void => {
  const handlers = prPageHandlers({ behind, isRebasing });
  vi.mocked(invoke).mockImplementation(async (command: string, args?: unknown) => {
    if (command === 'gh_run') {
      return { stdout: prPageGhStdout({ payload: args }), stderr: '', exitCode: 0 };
    }
    return handlers[command]?.(undefined) ?? new Promise<never>(() => undefined);
  });
};

const properties = (): HTMLElement => screen.getByRole('group', { name: 'Properties' });

type CellParams = {
  readonly id: string;
};

const cellText = ({ id }: CellParams): string =>
  document.querySelector(`[data-pr-status-strip] [data-cell="${id}"]`)?.textContent ?? '';

describe('the pull request page scenes', () => {
  it('registers the nine scenes of the plan', () => {
    expect(Object.keys(U23_PR_PAGE_SCENES).sort()).toEqual([
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

  it('branch-pr-github leads with the Pull request tab and its title as the one heading', async () => {
    draw({ name: 'branch-pr-github' });

    expect((await findSectionRow(/^Pull request/)).getAttribute('aria-current')).toBe('page');
    expect(sectionNames()[0]).toBe('Pull request');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Stop retried webhooks posting a second credit',
    );
  });

  it('branch-pr-github says checks, review, merge and branch once in the strip, people and links on the side', async () => {
    draw({ name: 'branch-pr-github' });
    await screen.findByRole('group', { name: 'Properties' });
    const side = within(properties());

    await waitFor(() => expect(cellText({ id: 'checks' })).toContain('1 failing'));
    expect(cellText({ id: 'checks' })).toContain('lint');
    expect(cellText({ id: 'review' })).toContain('Changes requested');
    expect(cellText({ id: 'merge' })).toContain('Blocked');
    expect(cellText({ id: 'branch' })).toContain('3 behind main');
    expect(side.getByText('#412')).toBeDefined();
    expect(side.getByText('Closes')).toBeDefined();
    expect(side.getByText('kenji-w')).toBeDefined();
    expect(side.queryByRole('region', { name: 'Base' })).toBeNull();
    expect(side.queryByRole('region', { name: 'Readiness' })).toBeNull();
    expect(side.queryByRole('button', { name: /Rebase/ })).toBeNull();
    expect(side.queryByRole('region', { name: 'Status' })).toBeNull();
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
    expect(within(activity).getByText(/requested changes/)).toBeDefined();
    expect(within(activity).getByRole('button', { name: /Open checks/ })).toBeDefined();
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

  it('branch-pr-merge-blocked says in Readiness why Merge cannot run', async () => {
    answerWith({ behind: 0 });
    draw({ name: 'branch-pr-merge-blocked' });

    await waitFor(() => expect(cellText({ id: 'checks' })).toContain('lint, contract tests'));
    await waitFor(() =>
      expect(
        document.querySelector('[data-branch-primary]')?.getAttribute('data-branch-primary'),
      ).toBe('tab.checks'),
    );
    expect(screen.queryByRole('button', { name: /^Merge/ })).toBeNull();
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
    expect(screen.queryByRole('button', { name: /^Merge/ })).toBeNull();
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
    expect(header().textContent).toBe('Pushed5 ahead, 3 behind main');
    await waitFor(() =>
      expect(
        document.querySelector('[data-branch-primary]')?.getAttribute('data-branch-primary'),
      ).toBe('diff.rebase'),
    );
    const create = screen.getByRole('button', { name: 'Create pull request' });
    expect(create.getAttribute('data-create-submit')).toBe('secondary');
    const strip = screen.getByRole('group', { name: 'Status' });
    expect(within(strip).getByText('3 behind')).toBeDefined();
    expect(within(strip).getByText('None yet')).toBeDefined();
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
    expect(
      within(screen.getByRole('region', { name: 'Summary' })).getByText('5', { selector: 'span' }),
    ).toBeDefined();
    expect(screen.queryByRole('region', { name: 'In this branch' })).toBeNull();
  });

  it('hides the form while a rebase is stopped and lists the conflicts instead', async () => {
    answerWith({ behind: 3, isRebasing: true });
    draw({ name: 'branch-pr-none' });

    expect(await screen.findByRole('region', { name: 'Conflicts' })).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Pull request title' })).toBeNull();
    expect(screen.queryByRole('button', { name: /create pull request/i })).toBeNull();
    expect(header().textContent).toContain('Rebasing');
    const strip = screen.getByRole('group', { name: 'Status' });
    const branch = strip.querySelector('[data-cell="branch"]');
    expect(branch?.getAttribute('data-tone')).toBe('warning');
    expect(branch?.textContent).toContain('Conflicts');
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
