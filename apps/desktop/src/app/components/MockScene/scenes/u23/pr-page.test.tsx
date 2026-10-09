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
import { U23_PR_PAGE_SCENES } from './pr-page';
import { prPageHandlers } from './prPageSeed';

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

const answerWith = ({ behind }: { readonly behind: number }): void => {
  const handlers = prPageHandlers({ behind });
  vi.mocked(invoke).mockImplementation(
    async (command: string, args?: unknown) =>
      handlers[command]?.(
        typeof args === 'object' && args !== null ? (args as Record<string, unknown>) : undefined,
      ) ?? new Promise<never>(() => undefined),
  );
};

const properties = (): HTMLElement => screen.getByRole('complementary', { name: 'Properties' });

describe('the pull request page scenes', () => {
  it('registers the eight scenes of the plan', () => {
    expect(Object.keys(U23_PR_PAGE_SCENES).sort()).toEqual([
      'branch-pr-draft',
      'branch-pr-editing',
      'branch-pr-github',
      'branch-pr-merge-blocked',
      'branch-pr-merge-methods',
      'branch-pr-merged',
      'branch-pr-narrow',
      'branch-pr-none',
    ]);
  });

  it('branch-pr-github leads with the Pull request tab and its title as the one heading', async () => {
    draw({ name: 'branch-pr-github' });

    expect(
      (await screen.findByRole('tab', { name: /^Pull request/ })).getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.getAllByRole('tab')[0]?.textContent).toMatch(/^Pull request/);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Stop retried webhooks posting a second credit',
    );
  });

  it('branch-pr-github reads the status, reviewers, checks, branch and files in the properties', async () => {
    draw({ name: 'branch-pr-github' });
    await screen.findByRole('complementary', { name: 'Properties' });
    const side = within(properties());

    expect(side.getByText('Blocked: 1 check failing')).toBeDefined();
    expect(side.getByText('#412')).toBeDefined();
    expect(side.getByText('kenji-w')).toBeDefined();
    expect(side.getByText('Approved')).toBeDefined();
    expect(side.getByText('Changes requested')).toBeDefined();
    expect(side.getByText('Pending')).toBeDefined();
    expect(side.getByText('1 failing, 5 passed')).toBeDefined();
    expect(side.getByText('hl/fix-duplicate-credit')).toBeDefined();
    expect(await side.findByText('3 behind main')).toBeDefined();
    expect(side.getByRole('button', { name: 'Rebase on main' })).toBeDefined();
    expect(side.getByText('5 files')).toBeDefined();
    expect(side.getByText('applyWebhook.ts')).toBeDefined();
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
    expect(within(activity).getByRole('button', { name: /View checks/ })).toBeDefined();
  });

  it('branch-pr-draft says the draft is not open for review yet', async () => {
    draw({ name: 'branch-pr-draft' });

    const side = within(await screen.findByRole('complementary', { name: 'Properties' }));
    expect(side.getByText('Draft, not open for review yet')).toBeDefined();
    expect(side.getByText('None requested')).toBeDefined();
  });

  it('branch-pr-editing opens the title and the description editors', async () => {
    draw({ name: 'branch-pr-editing' });

    expect(await screen.findByRole('textbox', { name: 'Pull request title' })).toBeDefined();
    expect(await screen.findByRole('textbox', { name: 'Description, markdown' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined();
    expect(screen.getByText('Enter saves, Esc cancels')).toBeDefined();
  });

  it('branch-pr-none offers the create form under an empty state', async () => {
    draw({ name: 'branch-pr-none' });

    expect(await screen.findByRole('heading', { name: 'No pull request yet' })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Pull request title' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create pull request' })).toBeDefined();
    expect(screen.getByRole('switch', { name: 'Open as draft' })).toBeDefined();
  });

  it('branch-pr-none picks the default base branch instead of an empty list', async () => {
    draw({ name: 'branch-pr-none' });

    await screen.findByRole('heading', { name: 'No pull request yet' });
    const base = await screen.findByRole('combobox', { name: 'Branch' });
    await waitFor(() => expect(base.textContent).toContain('main'));
    expect(base.textContent).not.toContain('[]');
  });

  it('branch-pr-merge-blocked prints why Merge cannot run', async () => {
    answerWith({ behind: 0 });
    draw({ name: 'branch-pr-merge-blocked' });

    expect((await screen.findByTestId('branch-blocked-reason')).textContent).toBe(
      '2 checks failing: lint, contract tests.',
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

    expect(await screen.findByRole('complementary', { name: 'Properties' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Description' })).toBeDefined();
  });

  it('branch-pr-merged says it merged into main and offers no merge', async () => {
    draw({ name: 'branch-pr-merged' });

    const side = within(await screen.findByRole('complementary', { name: 'Properties' }));
    expect(side.getAllByText('Merged').length).toBeGreaterThan(0);
    expect(
      within(screen.getByRole('region', { name: 'Activity' })).getByText(
        /merged this pull request/,
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Merge/ })).toBeNull();
  });
});
