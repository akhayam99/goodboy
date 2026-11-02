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

  it('shows every state once, each with one question title', () => {
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
      expect(node.querySelectorAll('h2[data-question-header]')).toHaveLength(1);
    }
  });

  const caseNode = ({
    container,
    name,
  }: {
    readonly container: HTMLElement;
    readonly name: string;
  }) => {
    const node = container.querySelector<HTMLElement>(`[data-qc-case="${name}"]`);
    if (node === null) {
      throw new Error(`no case ${name}`);
    }
    return node;
  };

  const mountScene = () => {
    const Scene = U34_QUESTION_CARD_SCENES[SCENE];
    return render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );
  };

  it('keeps the Something else row on the option geometry when it opens', () => {
    const { container } = mountScene();

    const rowOf = (name: string) => {
      const label = caseNode({ container, name }).querySelector<HTMLElement>(
        'button[aria-label="Something else"]',
      );
      return label?.closest<HTMLElement>('[data-selected], .grid') ?? null;
    };
    const closed = rowOf('single');
    const open = rowOf('custom-open');

    expect(closed?.children).toHaveLength(2);
    expect(open?.children).toHaveLength(2);
    expect(open?.className.replace('bg-selected', '').trim()).toBe(
      closed?.className.replace('hover:bg-hover', '').trim(),
    );
    const openColumn = open?.children[1];
    expect(openColumn?.firstElementChild?.getAttribute('aria-label')).toBe('Something else');
    expect(openColumn?.querySelector('textarea')?.value).toBe('Batch only the Northwind ones');
  });

  it('gives answered and resolved cards one result shape with the status row last', () => {
    const { container } = mountScene();

    const answered = caseNode({ container, name: 'answered' });
    const resolved = caseNode({ container, name: 'resolved-by-agent' });

    for (const node of [answered, resolved]) {
      const result = node.querySelector('[data-question-result]');
      expect(result?.lastElementChild?.querySelector('[role="status"]')).not.toBeNull();
    }
    const answer = answered.querySelector<HTMLElement>('[data-question-answer]');
    expect(answer?.textContent).toBe('Batch them');
    expect(resolved.querySelector('[data-question-answer]')).toBeNull();
    expect(resolved.querySelector('[role="status"]')?.textContent).toBe('Resolved by the agent');
  });
});
