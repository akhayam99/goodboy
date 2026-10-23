// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { findSectionRow, sectionNames } from '../../../../../test/branchRail';
import { U23_PR_PAGE_SCENES } from './pr-page';
import { prPageGhStdout, prPageHandlers } from './prPageSeed';

beforeAll(async () => {
  await importStore();
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

  it('branch-pr-github reads readiness, reviewers, checks, linked issues and base in the property block, with no Rebase', async () => {
    draw({ name: 'branch-pr-github' });
    await screen.findByRole('group', { name: 'Properties' });
    const side = within(properties());

    expect(screen.getByTestId('pr-readiness').textContent).toContain('lint');
    expect(side.getByText('#412')).toBeDefined();
    expect(side.getByText('Closes')).toBeDefined();
    expect(side.getByText('kenji-w')).toBeDefined();
    expect(side.getByText('Approved')).toBeDefined();
    expect(side.getByText('Changes requested')).toBeDefined();
    expect(side.getByText('Pending')).toBeDefined();
    expect(side.getByText('1 failing')).toBeDefined();
    expect(side.getByRole('region', { name: 'Base' }).textContent).toContain('main');
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
    expect(side.getByText('None requested')).toBeDefined();
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

    expect((await screen.findByTestId('pr-readiness')).textContent).toContain(
      'lint, contract tests',
    );
    expect((screen.getByRole('button', { name: /^Merge/ }) as HTMLButtonElement).disabled).toBe(
      true,
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
