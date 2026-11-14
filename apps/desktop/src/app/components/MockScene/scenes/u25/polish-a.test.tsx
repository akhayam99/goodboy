// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U25_POLISH_A_SCENES } from './polish-a';

const WAIT = { timeout: 15_000 };

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

const mount = ({ id }: { readonly id: keyof typeof U25_POLISH_A_SCENES }): void => {
  const Scene = U25_POLISH_A_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the polish-a scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U25_POLISH_A_SCENES).sort()).toEqual(['artifact-plan-fill']);
    expect(MOCK_SCENES['artifact-plan-fill']).toBe(U25_POLISH_A_SCENES['artifact-plan-fill']);
  });

  it('artifact-plan-fill gives the page prose the full column', async () => {
    mount({ id: 'artifact-plan-fill' });

    const body = await screen.findByTestId('plan-body', undefined, WAIT);
    const prose = body.querySelectorAll('[data-measure]');
    expect(prose.length).toBeGreaterThan(0);
    for (const node of prose) {
      expect(node.getAttribute('data-measure')).toBe('full');
    }
  });
});
