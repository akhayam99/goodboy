// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import { runA11yCheck } from '../../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../../..';
import { U33_OVERVIEW_NEEDS_YOU_SCENES } from './overview-needs-you';

const WAIT = { timeout: 15_000 };
const SCENE = 'u33-overview-needs-you';

beforeAll(async () => {
  installFakeResizeObserver();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const mount = () => {
  const Scene = U33_OVERVIEW_NEEDS_YOU_SCENES[SCENE];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u33 overview needs you scene', () => {
  it('is registered once', () => {
    expect(MOCK_SCENES[SCENE]).toBe(U33_OVERVIEW_NEEDS_YOU_SCENES[SCENE]);
  });

  it('holds one 680px frame with no padding on it', async () => {
    const { container } = mount();

    await waitFor(() => expect(container.querySelectorAll('[data-shot]')).toHaveLength(1), WAIT);
    const frame = container.querySelector<HTMLElement>('[data-shot]');
    expect(frame?.style.width).toBe('680px');
    expect(frame?.style.padding).toBe('');
  });

  it('is one list with no Decide or Fix header and no subject twice', async () => {
    const { container } = mount();

    const needsYou = await screen.findByRole('region', { name: 'Needs you' }, WAIT);
    expect(needsYou.querySelectorAll('[data-next-group-head] [class*="text-meta"]')).toHaveLength(
      0,
    );
    const cards = [...needsYou.querySelectorAll('[data-action-card]')];
    const live = [...needsYou.querySelectorAll('[data-needs-you-live] [data-live-row]')];
    expect(new Set(cards.map((card) => card.textContent)).size).toBe(cards.length);
    expect(container.querySelector('[data-live-section="needs-you"]')).toBeNull();
    const count = needsYou.querySelector('[data-overview-count]')?.textContent;
    expect(count).toBe(String(cards.length + live.length));
  });

  it('holds one primary and gives the other rows no second verb and no overflow at rest', async () => {
    const { container } = mount();

    const needsYou = await screen.findByRole('region', { name: 'Needs you' }, WAIT);
    expect(container.querySelectorAll('[data-variant="primary"]').length).toBeLessThanOrEqual(1);
    const cards = [...needsYou.querySelectorAll('[data-action-card]')];
    for (const card of cards.slice(1)) {
      expect(card.querySelectorAll('button').length).toBeLessThanOrEqual(1);
      expect(card.querySelector('[data-slot="header-actions-overflow"]')).toBeNull();
    }
  });

  it('says what is happening in one glance line fed by the card counts', async () => {
    const { container } = mount();

    await screen.findByRole('region', { name: 'Needs you' }, WAIT);
    const glance = container.querySelector('[data-overview-glance]');
    expect(glance?.getAttribute('data-overview-glance')).toBe('waiting');
    expect(glance?.textContent).toContain('need you');
  });

  it('has no accessibility violations', async () => {
    const { container } = mount();

    await screen.findByRole('region', { name: 'Needs you' }, WAIT);
    const { violations } = await runA11yCheck(container);
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
