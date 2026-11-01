// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U34_QUESTION_CARD_SCENES } from './question-card-states';
import { QUESTION_CARD_CASES } from './questionCardStatesSeed';

const SCENE = 'u34-question-card-states';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('the u34 question card states scene', () => {
  it('registers the scene for the capture', () => {
    expect(MOCK_SCENES[SCENE]).toBe(U34_QUESTION_CARD_SCENES[SCENE]);
  });

  it('shows every state once, each with one header row holding the question', () => {
    const Scene = U34_QUESTION_CARD_SCENES[SCENE];
    const { container } = render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    const cases = Array.from(container.querySelectorAll<HTMLElement>('[data-qc-case]'));
    expect(cases.map((node) => node.dataset.qcCase)).toEqual(
      QUESTION_CARD_CASES.map((entry) => entry.name),
    );
    for (const node of cases) {
      expect(node.querySelectorAll('[data-question-header]')).toHaveLength(1);
      expect(node.querySelectorAll('[data-question-header] h2')).toHaveLength(1);
    }
  });
});
