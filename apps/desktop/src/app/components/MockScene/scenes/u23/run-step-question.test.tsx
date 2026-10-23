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

  it('says which running step waits on you, with Answer as the one header primary', async () => {
    const Scene = U23_RUN_STEP_QUESTION_SCENES['workflow-run-step-question'];
    if (Scene === undefined) {
      throw new Error('no workflow-run-step-question scene');
    }
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    const tail = await waitFor(() => {
      const node = document.querySelector<HTMLElement>('[data-orchestrated-tail]');
      expect(node?.getAttribute('data-orchestrated-tail')).toBe('needs-answer');
      return node;
    });
    if (tail === null) {
      throw new Error('no orchestrated tail');
    }
    expect(tail.textContent).toContain('Waiting for your answer on step 4');
    expect(tail.textContent).not.toContain('is running');
    expect(within(tail).queryByRole('button', { name: 'Answer' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Answer' })).toHaveLength(1);
  });
});
