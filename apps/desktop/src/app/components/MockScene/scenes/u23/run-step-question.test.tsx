// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U23_RUN_STEP_QUESTION_SCENES } from './run-step-question';

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
  vi.restoreAllMocks();
});

describe('the run step question scene', () => {
  it('names its scene', () => {
    expect(Object.keys(U23_RUN_STEP_QUESTION_SCENES)).toEqual(['workflow-run-step-question']);
  });

  it('says which running step waits on you instead of waiting on it, and offers Answer in the header', async () => {
    const Scene = U23_RUN_STEP_QUESTION_SCENES['workflow-run-step-question'];
    if (Scene === undefined) {
      throw new Error('no workflow-run-step-question scene');
    }
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('orchestrator-strip').getAttribute('data-phase')).toBe(
        'needs-answer',
      );
    });
    expect(screen.getByTestId('orchestrator-state').textContent).toContain(
      'Paused for your answer · step 4 · Record the attempts on each delivery in notify-relay',
    );
    expect(screen.getByTestId('orchestrator-state').textContent).not.toContain('Waiting on step');
    const header = screen.getByTestId('run-header');
    expect(within(header).getByRole('button', { name: 'Answer' })).toBeDefined();
    expect(
      within(screen.getByTestId('orchestrator-strip')).queryByRole('button', { name: 'Answer' }),
    ).toBeNull();
  });
});
