// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U24_PRPAGE_CREATE_SCENES } from './prpage-create';

const STATES = ['empty', 'typing', 'writing', 'ready', 'creating', 'failed'] as const;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  window.history.replaceState(null, '', '/');
});

const renderScene = ({
  name,
  state,
}: {
  readonly name: keyof typeof U24_PRPAGE_CREATE_SCENES;
  readonly state: string;
}) => {
  window.history.replaceState(null, '', `/?state=${state}`);
  const Scene = U24_PRPAGE_CREATE_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const WAIT = { timeout: 3_000 };

describe('the u24 prpage create scenes', () => {
  it.each(STATES)('draws the %s state of the pull request form', async (state) => {
    renderScene({ name: 'branch-create', state });

    expect(await screen.findByRole('region', { name: 'Pull request text' }, WAIT)).toBeDefined();
    expect(screen.getAllByRole('button', { name: /Create (draft )?pull request/ }).length).toBe(1);
  });

  it('offers Write with Scribe and no Discard text while nothing is typed', async () => {
    renderScene({ name: 'branch-create', state: 'empty' });

    expect(await screen.findByRole('button', { name: 'Write with Scribe' }, WAIT)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Discard text' })).toBeNull();
  });

  it('draws the merge request form on the same grammar', async () => {
    renderScene({ name: 'branch-create-gitlab', state: 'empty' });

    expect(await screen.findByRole('textbox', { name: 'Merge request title' }, WAIT)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Write with Scribe' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create merge request' })).toBeDefined();
  });
});
