// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { U24_P_COMPOSER_SCENES } from './p-composer';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

const WAIT = { timeout: 4000 };

const renderScene = (lead: string | null) => {
  window.history.replaceState(null, '', lead === null ? '/' : `/?lead=${lead}`);
  const Scene = U24_P_COMPOSER_SCENES.agentlead;
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u24 composer scene', () => {
  it('registers the agent lead scene', () => {
    expect(Object.keys(U24_P_COMPOSER_SCENES)).toEqual(['agentlead']);
  });

  it.each([
    ['stopped', true, false, false],
    ['next', false, true, false],
    ['firstlap', false, false, true],
    ['all', true, true, true],
  ])(
    'keeps the lead above the transcript and the message box inside the fill slot for lead=%s',
    async (lead, hasStopped, hasNext, hasFirstLap) => {
      const { container } = renderScene(lead);

      const composer = await screen.findByRole('textbox', undefined, WAIT);
      const fill = container.querySelector('[data-slot="pane-fill"]') as HTMLElement;
      expect(fill.contains(composer)).toBe(true);
      expect(screen.queryByText('First lap') !== null).toBe(hasFirstLap);
      expect(container.querySelector('[data-agent-stopped]') !== null).toBe(hasStopped);
      expect(screen.queryByTestId('next-action-strip') !== null).toBe(hasNext);
      const leadSlot = container.querySelector('[data-slot="pane-lead"]');
      if (hasStopped || hasNext || hasFirstLap) {
        expect(leadSlot).not.toBeNull();
        expect(leadSlot?.contains(composer)).toBe(false);
      }
    },
  );

  it('opens with every lead block when the address names none', async () => {
    const { container } = renderScene(null);

    await screen.findByRole('textbox', undefined, WAIT);
    expect(container.querySelector('[data-agent-stopped]')).not.toBeNull();
    expect(screen.getByTestId('next-action-strip')).toBeDefined();
    expect(screen.getByText('First lap')).toBeDefined();
  });

  it.each(['stopped', 'next', 'firstlap', 'all'])(
    'has no accessibility violation for lead=%s',
    async (lead) => {
      const { container } = renderScene(lead);

      await screen.findByRole('textbox', undefined, WAIT);
      const { violations } = await runA11yCheck(container);

      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
