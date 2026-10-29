// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentType } from 'react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { U24_AUTO_CHAT_SCENES } from '../u24/auto-chat';
import { U25_C07_AUTO_SCENES } from './c07-auto';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type MountParams = {
  readonly Scene: ComponentType | undefined;
};

const mount = ({ Scene }: MountParams): void => {
  if (Scene === undefined) {
    throw new Error('no scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const autoLevel = async (): Promise<HTMLElement> =>
  screen.findByRole('region', { name: 'Agents' }, WAIT);

describe('Auto: every capability keeps a home in Auto', () => {
  it('Start Auto from the Start a run field on the Runs page, with the Limit chip', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-start'] });

    const start = await screen.findByRole('region', { name: 'Start a run' }, WAIT);
    expect(within(start).getByRole('textbox', { name: 'Start a run' })).toBeDefined();
    expect(within(start).getByText('No limit')).toBeDefined();
    expect(screen.queryByText(/Spend cap/)).toBeNull();
  });

  it('Agents tree task, model and time: the task and the model in the row tooltip', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-working'] });

    const level = await autoLevel();
    const implementer = within(level).getByRole('treeitem', { name: /^Implementer, / });
    fireEvent.pointerEnter(implementer, { pointerType: 'mouse' });
    const card = (await screen.findByTestId('fact-card', undefined, WAIT)).textContent;
    expect(card).toContain('Post one credit per retry');
    expect(card).toContain('Sonnet 5.5');
  });

  it('Spent, Reserved, Left: the Limit chip says spent of limit, its popover the rest', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-working'] });

    await autoLevel();
    fireEvent.click(screen.getByRole('button', { name: /^Limit: \$0\.27 of \$10\.00/ }));
    const popover = screen.getByRole('dialog', { name: 'Limit' });
    expect(within(popover).getByText('Spent')).toBeDefined();
    expect(within(popover).getByText('$0.27')).toBeDefined();
    expect(within(popover).getByText('Reserved')).toBeDefined();
    expect(within(popover).getByText('$4.50')).toBeDefined();
    expect(within(popover).getByText('Turns')).toBeDefined();
  });

  it('Delegation reason and model changed note, no Reserved up to: the child pane brief', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-child'] });

    expect(await screen.findByText(/^Why Auto chose Implementer:/, undefined, WAIT)).toBeDefined();
    expect(screen.queryByText(/Reserved up to/)).toBeNull();
  });

  it('Delegation result and Returned to Auto: the end of the child pane', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-child-done'] });

    expect(await screen.findByText('Returned to Auto', undefined, WAIT)).toBeDefined();
    expect(screen.getByText('Not checked: timed out')).toBeDefined();
  });

  it('Auto phase words and Change approach: the tail of the Auto chat', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-working'] });

    const tail = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-auto-tail]');
      expect(found).not.toBeNull();
      return found;
    }, WAIT);
    if (tail === null) {
      throw new Error('no tail');
    }
    expect(tail.textContent).toContain('Waiting for Implementer and Tester');
    expect(within(tail).getByRole('button', { name: 'Change approach' })).toBeDefined();
    expect(within(tail).getByRole('button', { name: 'Stop Auto and its agents' })).toBeDefined();
  });

  it('Composer placeholder by state: Message Auto while Auto waits', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-working'] });

    expect(await screen.findByPlaceholderText('Message Auto', undefined, WAIT)).toBeDefined();
  });

  it('Revision line: the same producer line says revising v2', async () => {
    mount({ Scene: U24_AUTO_CHAT_SCENES['auto-chat-revising'] });

    expect(await screen.findByText('revising v2', undefined, WAIT)).toBeDefined();
  });

  it('Confirm a revise: the Next step card with Not now under its line', async () => {
    mount({ Scene: U24_AUTO_CHAT_SCENES['auto-chat-confirm'] });

    const card = await screen.findByRole('region', { name: 'Next step' }, WAIT);
    expect(
      within(card).getAllByText('Revise Retry-safe credit retries to v2').length,
    ).toBeGreaterThan(0);
    expect(within(card).getByRole('button', { name: 'Not now' })).toBeDefined();
  });

  it('Auto plan approval: the ask with View plan, then Approve plan in the plan view', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-plan'] });

    expect(await screen.findByText('Plan v1 needs your approval', undefined, WAIT)).toBeDefined();
    const viewPlan = screen.getByText('View plan').closest('button');
    if (viewPlan === null) {
      throw new Error('no View plan');
    }
    fireEvent.click(viewPlan);
    expect(await screen.findByText('Approve plan', undefined, WAIT)).toBeDefined();
  });

  it('Child page notice with Open Auto, after Open full', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-child'] });

    const openFull = (await screen.findByText('Open full', undefined, WAIT)).closest('button');
    if (openFull === null) {
      throw new Error('no Open full');
    }
    fireEvent.click(openFull);

    expect(await screen.findByText('Open Auto', undefined, WAIT)).toBeDefined();
    expect(screen.getByText('Started by Auto. Auto sees what you tell it.')).toBeDefined();
  });
});
