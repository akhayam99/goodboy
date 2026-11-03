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
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { aWorkflowRun } from '@goodboy/types/testing';
import { HintRowsBody } from './testing/HintRowsBody';
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

const field = () => screen.getByRole('textbox', { name: 'Hint for the orchestrator' });

const mountBody = () => {
  const { session, run, workflow } = hintRowsFixture.seed({ hints: [], agentCount: 2 });
  return render(<HintRowsBody session={session} run={run} workflow={workflow} />);
};

describe('orchestrator hint draft', () => {
  it('keeps the typed text when the composer unmounts and comes back', () => {
    const first = mountBody();
    fireEvent.change(field(), { target: { value: 'cap the webhook backoff at 2 s' } });
    first.unmount();

    mountBody();

    expect(field()).toHaveProperty('value', 'cap the webhook backoff at 2 s');
  });

  it('keeps the text in the store under the run id it was typed for', () => {
    const { run } = hintRowsFixture.seed({ hints: [], agentCount: 2 });
    const first = mountBody();
    fireEvent.change(field(), { target: { value: 'check the ledger' } });

    expect(useAppStore.getState().orchestratorHintDrafts[run.id]).toBe('check the ledger');
    first.unmount();
  });

  it('empties the stored draft once the hint is saved', async () => {
    const { run } = hintRowsFixture.seed({ hints: [], agentCount: 2 });
    useAppStore.setState({ addWorkflowOrchestratorHint: async () => null });
    mountBody();
    fireEvent.change(field(), { target: { value: 'skip the visual suite' } });
    fireEvent.keyDown(field(), { key: 'Enter' });

    await waitFor(() => expect(field()).toHaveProperty('value', ''));
    expect(useAppStore.getState().orchestratorHintDrafts[run.id]).toBeUndefined();
  });

  it('keeps the stored draft when the hint could not be saved', async () => {
    const { run } = hintRowsFixture.seed({ hints: [], agentCount: 2 });
    useAppStore.setState({
      addWorkflowOrchestratorHint: async () => {
        throw new Error('disk full');
      },
      reportError: async () => undefined,
    });
    mountBody();
    fireEvent.change(field(), { target: { value: 'retry the settlement export' } });
    fireEvent.keyDown(field(), { key: 'Enter' });

    await waitFor(() =>
      expect(useAppStore.getState().orchestratorHintDrafts[run.id]).toBe(
        'retry the settlement export',
      ),
    );
    expect(field()).toHaveProperty('value', 'retry the settlement export');
  });

  it('does not overwrite a newer draft when a send fails after a remount', async () => {
    const { run } = hintRowsFixture.seed({ hints: [], agentCount: 2 });
    let fail: (error: Error) => void = () => undefined;
    useAppStore.setState({
      addWorkflowOrchestratorHint: () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
      reportError: async () => undefined,
    });
    const first = mountBody();
    fireEvent.change(field(), { target: { value: 'first message' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    first.unmount();
    mountBody();
    fireEvent.change(field(), { target: { value: 'newer draft' } });

    await act(async () => {
      fail(new Error('disk full'));
    });

    expect(useAppStore.getState().orchestratorHintDrafts[run.id]).toBe('newer draft');
    expect(field()).toHaveProperty('value', 'newer draft');
  });

  it('restores the failed message after a remount when the run draft is still empty', async () => {
    const { run } = hintRowsFixture.seed({ hints: [], agentCount: 2 });
    let fail: (error: Error) => void = () => undefined;
    useAppStore.setState({
      addWorkflowOrchestratorHint: () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
      reportError: async () => undefined,
    });
    const first = mountBody();
    fireEvent.change(field(), { target: { value: 'first message' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    first.unmount();
    mountBody();

    await act(async () => {
      fail(new Error('disk full'));
    });

    expect(useAppStore.getState().orchestratorHintDrafts[run.id]).toBe('first message');
    expect(field()).toHaveProperty('value', 'first message');
  });

  it('does not show one run draft in another run', () => {
    const first = mountBody();
    fireEvent.change(field(), { target: { value: 'only for Harborline' } });
    first.unmount();

    const other = hintRowsFixture.seed({ hints: [], agentCount: 2 });
    const otherRun = { ...other.run, id: aWorkflowRun().id };
    expect(otherRun.id).not.toBe(other.run.id);
    render(<HintRowsBody session={other.session} run={otherRun} workflow={other.workflow} />);

    expect(field()).toHaveProperty('value', '');
  });
});
