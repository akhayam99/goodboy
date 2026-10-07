// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { U21_PLAN_DRAWER_SCENES } from './plan-drawer';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const SCENE_IDS = [
  'plan-drawer-waiting',
  'plan-drawer-drafts',
  'plan-drawer-revising',
  'plan-drawer-unchanged',
  'plan-drawer-question',
  'plan-drawer-editing',
  'plan-drawer-conflict',
  'plan-drawer-split',
] as const;

const renderScene = (id: (typeof SCENE_IDS)[number]) => {
  const Scene = U21_PLAN_DRAWER_SCENES[id];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const filled = (): ReadonlyArray<string> =>
  Array.from(document.querySelectorAll('[data-filled="true"]')).map(
    (node) => node.textContent ?? '',
  );

const WAIT = { timeout: 4_000 };

describe('the plan drawer scenes', () => {
  it('registers exactly the scenes the plan names', () => {
    expect(Object.keys(U21_PLAN_DRAWER_SCENES).sort()).toEqual([...SCENE_IDS].sort());
  });

  it('waiting: a run held for its plan, one filled Approve, no comment yet', async () => {
    renderScene('plan-drawer-waiting');

    await screen.findByTestId('plan-drawer');
    expect(screen.getByTestId('plan-drawer-toolbar').textContent).toContain('v2');
    expect(screen.getByTestId('plan-primary').textContent).toBe('Approve');
    expect(filled()).toEqual(['Approve']);
    expect(screen.getByTestId('plan-comment-bar').textContent).toContain(
      'Select text or click a block to comment',
    );
  });

  it('drafts: Send is the one filled button and Approve turns secondary', async () => {
    renderScene('plan-drawer-drafts');

    await screen.findByTestId('plan-comment-bar');
    expect(screen.getByTestId('plan-comment-bar').textContent).toContain('3 comments');
    expect(screen.getByTestId('plan-primary').getAttribute('data-filled')).toBe('false');
    const drawer = screen.getByRole('region', { name: 'Reconcile the settlement export' });
    expect(
      Array.from(drawer.querySelectorAll('[data-filled="true"]')).map((n) => n.textContent),
    ).toEqual(['Send to planner']);
  });

  it('revising: the body dims with a Revising line and the primary says why it waits', async () => {
    renderScene('plan-drawer-revising');

    const line = await screen.findByTestId('plan-drawer-state-line');
    expect(line.textContent).toContain('Revising to v3');
    expect(screen.getByTestId('plan-drawer-body').getAttribute('data-revising')).toBe('true');
    const drawer = screen.getByRole('region', { name: 'Reconcile the settlement export' });
    expect(within(drawer).getByTestId('plan-drawer-reason').textContent).toBe(
      'The planner is revising this plan',
    );
  });

  it('unchanged: the planner answered, with Open the reply, and the comments stay open', async () => {
    renderScene('plan-drawer-unchanged');

    expect(
      await screen.findByText('The planner answered without changing the plan', undefined, WAIT),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open the reply' })).toBeDefined();
    await waitFor(
      () =>
        expect(
          screen.getAllByTestId('plan-comment').map((card) => card.getAttribute('data-status')),
        ).toEqual(['open', 'open', 'open']),
      WAIT,
    );
  });

  it('question: the planner question is at the top with Answer and the bar waits', async () => {
    renderScene('plan-drawer-question');

    const question = await screen.findByTestId('plan-drawer-question');
    expect(question.textContent).toContain('Should refunds older than 90 days stay in the export?');
    expect(within(question).getByRole('button', { name: 'Answer' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Send to planner' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('editing: the editor replaces the plan, with Save as the one filled button', async () => {
    renderScene('plan-drawer-editing');

    expect(await screen.findByRole('textbox', undefined, WAIT)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined();
    expect(screen.queryByTestId('plan-primary')).toBeNull();
  });

  it('conflict: the save failed inline and the text is kept', async () => {
    renderScene('plan-drawer-conflict');

    expect(
      await screen.findByText('The planner wrote v3 meanwhile', undefined, WAIT),
    ).toBeDefined();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toContain('to the cent.');
    expect(screen.getByRole('button', { name: 'Copy your text' })).toBeDefined();
  });

  it('split: Edit is off and says the plan runs as parallel parts', async () => {
    renderScene('plan-drawer-split');

    const edit = await screen.findByTestId('plan-drawer-edit');
    expect(edit.hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('plan-drawer-reason').textContent).toBe(
      'This plan runs as 3 parallel parts. Ask the planner to change it.',
    );
  });
});
