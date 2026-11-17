// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentType } from 'react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { startRunEventName } from '../../../../../features/session/startRun/startRunEventName';
import { U24_AUTO_CHAT_SCENES } from '../u24/auto-chat';
import { U25_C07_AUTO_SCENES } from './c07-auto';

const WAIT = { timeout: 15_000 };

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
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

describe('Auto: every capability keeps a home in Auto', () => {
  it('Start Auto from the Start a run field on the Runs page, with the Limit chip', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-start'] });

    await screen.findByRole('list', { name: 'Runs' }, WAIT);
    const sessionId = useAppStore.getState().currentSessionId;
    act(() => {
      if (sessionId !== null) {
        window.dispatchEvent(new CustomEvent(startRunEventName({ sessionId })));
      }
    });
    const start = await screen.findByRole('region', { name: 'Start a run' }, WAIT);
    expect(within(start).getByRole('textbox', { name: 'Start a run' })).toBeDefined();
    expect(start.querySelector('[data-start-settings-line]')?.textContent).toContain('Limit none');
    expect(screen.queryByText(/Spend cap/)).toBeNull();
  });

  it('Spent, Reserved, Left: the Limit chip says the limit, its popover the rest', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-working'] });

    fireEvent.click(await screen.findByRole('button', { name: /^Limit: \$10\.00/ }, WAIT));
    const popover = screen.getByRole('dialog', { name: 'Limit' });
    expect(within(popover).getByText('Spent')).toBeDefined();
    expect(within(popover).getByText('$0.27')).toBeDefined();
    expect(within(popover).getByText('Reserved')).toBeDefined();
    expect(within(popover).getByText('$4.50')).toBeDefined();
    expect(within(popover).getByText('Turns')).toBeDefined();
  });

  it('Delegation reason and model changed note, no Reserved up to: the child page brief', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-child'] });

    expect(
      await screen.findByText(/^Why the Lead chose Implementer:/, undefined, WAIT),
    ).toBeDefined();
    expect(screen.queryByText(/Reserved up to/)).toBeNull();
  });

  it('Delegation result and Returned to Auto: the end of the child page', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-child-done'] });

    expect(await screen.findByText('Returned to Auto', undefined, WAIT)).toBeDefined();
    expect(screen.getByText('Not checked: timed out')).toBeDefined();
  });

  it('Auto phase words and the one Stop: the dock line and the session head', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-working'] });

    const dock = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-dock-live]');
      expect(found?.textContent).toContain('Implementer');
      return found;
    }, WAIT);
    if (dock === null) {
      throw new Error('no dock');
    }
    expect(within(dock).queryByRole('button', { name: 'Stop run' })).toBeNull();
    expect(await screen.findByRole('button', { name: 'Stop run' }, WAIT)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Change approach' })).toBeNull();
  });

  it('Composer placeholder by state: Message Lead while the Lead waits', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-working'] });

    expect(await screen.findByPlaceholderText('Message Lead', undefined, WAIT)).toBeDefined();
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
    expect(within(card).getByRole('button', { name: 'Decline' })).toBeDefined();
  });

  it('Auto plan approval: the dock asks with the approve label and keeps Open plan one click away', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-plan'] });

    expect(await screen.findByText('Plan v1 needs approval', undefined, WAIT)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Approve and start Build' })).toBeDefined();
    const openPlan = screen.getByText('Open plan').closest('button');
    if (openPlan === null) {
      throw new Error('no Open plan');
    }
    fireEvent.click(openPlan);
    expect(await screen.findAllByText('Approve and start Build', undefined, WAIT)).not.toHaveLength(
      0,
    );
  });

  it('Child page notice: the started by Auto line sits in the brief, the back row goes to Auto', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-child'] });

    expect(
      await screen.findByText(
        'The Lead started this agent and reads your messages to it.',
        undefined,
        WAIT,
      ),
    ).toBeDefined();
    expect(screen.queryByText('Open Auto')).toBeNull();
    expect([...document.querySelectorAll('[data-session-crumbs] li')].at(-2)?.textContent).toMatch(
      /^Why does the ledger retry post a second credit/,
    );
  });
});
