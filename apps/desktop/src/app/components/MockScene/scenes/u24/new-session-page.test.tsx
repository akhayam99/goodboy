// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U24_NEW_SESSION_PAGE_SCENES } from './new-session-page';

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
  window.history.replaceState(null, '', '/');
});

type SceneId = keyof typeof U24_NEW_SESSION_PAGE_SCENES;

const mount = ({ id }: { readonly id: SceneId }): void => {
  const Scene = U24_NEW_SESSION_PAGE_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the New session page scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U24_NEW_SESSION_PAGE_SCENES).sort()).toEqual([
      'new-session-page-agent',
      'new-session-page-agent-auto',
      'new-session-page-run',
      'new-session-page-run-preset',
    ]);
    for (const [id, Scene] of Object.entries(U24_NEW_SESSION_PAGE_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('new-session-page-run draws Run an orchestrator with its line, no Use session goal and one Run an orchestrator', async () => {
    mount({ id: 'new-session-page-run' });

    expect(await screen.findByRole('textbox', { name: 'Goal' }, WAIT)).toBeDefined();
    expect(
      screen.getByText('The orchestrator picks each next step until the goal is done.'),
    ).toBeDefined();
    expect(screen.queryByText('Likely steps')).toBeNull();
    expect(screen.queryByRole('button', { name: /use session goal/i })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Run an orchestrator' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Discard' })).toBeDefined();
    expect(screen.getByRole('button', { name: /start blank/i })).toBeDefined();
  });

  it('new-session-page-run-preset draws one model chip per preset step', async () => {
    mount({ id: 'new-session-page-run-preset' });

    expect(
      await screen.findByRole('button', { name: 'Model for Scout the retry path' }, WAIT),
    ).toBeDefined();
    expect(await screen.findByRole('button', { name: 'Model for Build the guard' })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Limit:/ })).toBeDefined();
    expect(screen.getByTestId('plan-estimate')).toBeDefined();
  });

  it('new-session-page-agent is the agent start of today', async () => {
    mount({ id: 'new-session-page-agent' });

    expect(await screen.findByRole('textbox', { name: 'Scout focus' }, WAIT)).toBeDefined();
    expect(screen.getByText('One agent in the role you pick.')).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Auto' })).toBeNull();
  });

  it('new-session-page-agent-auto is the Auto composer with one line about Auto', async () => {
    mount({ id: 'new-session-page-agent-auto' });

    expect(await screen.findByRole('region', { name: 'Auto' }, WAIT)).toBeDefined();
    expect(
      screen.getByText('Auto answers, or hands the work to the roles it picks.'),
    ).toBeDefined();
    expect(screen.queryByText('It may not work well yet.')).toBeNull();
    expect(screen.getByText('Experimental')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start an auto' })).toBeDefined();
  });
});
