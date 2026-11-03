// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { WorkflowRun } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { OrchestratedRunPage } from './index';
import { hintRowsFixture } from './testing/hintRowsFixture';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({});
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const composerField = (): HTMLTextAreaElement => {
  const node = document.querySelector('[data-orchestrated-composer] textarea');
  if (!(node instanceof HTMLTextAreaElement)) {
    throw new Error('no running composer');
  }
  return node;
};

const continueField = (): HTMLTextAreaElement => {
  const node = document.querySelector('[data-orchestrated-continue] textarea');
  if (!(node instanceof HTMLTextAreaElement)) {
    throw new Error('no continue form');
  }
  return node;
};

type FinishParams = {
  readonly outcome: 'done' | 'blocked';
};

const mountRunning = () => {
  const seeded = hintRowsFixture.seed({ hints: [], agentCount: 2 });
  const view = render(
    <OrchestratedRunPage session={seeded.session} run={seeded.run} workflow={seeded.workflow} />,
  );
  return { seeded, view };
};

const finish = ({ outcome }: FinishParams, seeded: ReturnType<typeof mountRunning>['seeded']) => {
  const finished: WorkflowRun = { ...seeded.run, orchestrationOutcome: outcome };
  const session = { ...seeded.session, workflowRuns: [finished] };
  act(() => {
    useAppStore.setState({
      sessions: [session],
      sessionPhaseRuns: {
        [session.id]: seeded.agents.map((agent) => ({ ...agent, status: 'completed' })),
      },
    });
  });
  return { session, run: finished };
};

describe('continue form draft', () => {
  it.each(['done', 'blocked'] as const)(
    'keeps the text typed while the run was going when the run becomes %s',
    async (outcome) => {
      const { seeded, view } = mountRunning();
      fireEvent.change(composerField(), { target: { value: 'cap the webhook backoff at 2 s' } });

      const next = finish({ outcome }, seeded);
      view.rerender(
        <OrchestratedRunPage session={next.session} run={next.run} workflow={seeded.workflow} />,
      );

      await waitFor(() => expect(continueField().value).toBe('cap the webhook backoff at 2 s'));
    },
  );

  it('keeps an edit made in the continue form across a remount', async () => {
    const { seeded, view } = mountRunning();
    const next = finish({ outcome: 'done' }, seeded);
    view.rerender(
      <OrchestratedRunPage session={next.session} run={next.run} workflow={seeded.workflow} />,
    );
    await waitFor(() => expect(continueField()).toBeTruthy());
    fireEvent.change(continueField(), { target: { value: 'now prove the retries stop' } });
    view.unmount();

    render(
      <OrchestratedRunPage session={next.session} run={next.run} workflow={seeded.workflow} />,
    );

    expect(continueField().value).toBe('now prove the retries stop');
  });

  it('clears the stored draft only after the continuation was sent', async () => {
    const { seeded, view } = mountRunning();
    const next = finish({ outcome: 'done' }, seeded);
    let isRelease: () => void = () => undefined;
    useAppStore.setState({
      continueWithHint: () =>
        new Promise<void>((resolve) => {
          isRelease = resolve;
        }),
    });
    view.rerender(
      <OrchestratedRunPage session={next.session} run={next.run} workflow={seeded.workflow} />,
    );
    await waitFor(() => expect(continueField()).toBeTruthy());
    fireEvent.change(continueField(), { target: { value: 'ship the fix' } });
    fireEvent.keyDown(continueField(), { key: 'Enter' });

    expect(useAppStore.getState().orchestratorHintDrafts[next.run.id]).toBe('ship the fix');
    await act(async () => {
      isRelease();
    });

    await waitFor(() =>
      expect(useAppStore.getState().orchestratorHintDrafts[next.run.id]).toBeUndefined(),
    );
  });

  it('keeps the stored draft when the continuation failed', async () => {
    const { seeded, view } = mountRunning();
    const next = finish({ outcome: 'done' }, seeded);
    useAppStore.setState({
      continueWithHint: async () => {
        throw new Error('disk full');
      },
    });
    view.rerender(
      <OrchestratedRunPage session={next.session} run={next.run} workflow={seeded.workflow} />,
    );
    await waitFor(() => expect(continueField()).toBeTruthy());
    fireEvent.change(continueField(), { target: { value: 'ship the fix' } });
    fireEvent.keyDown(continueField(), { key: 'Enter' });

    await waitFor(() => expect(document.querySelector('[role="alert"]')).not.toBeNull());
    expect(useAppStore.getState().orchestratorHintDrafts[next.run.id]).toBe('ship the fix');
    expect(continueField().value).toBe('ship the fix');
  });
});
