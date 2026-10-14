// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { aSession } from '@goodboy/types/testing';
import { UndoToastBridge } from '../../../../app/components/UndoToastBridge';
import { ToastProvider } from '../../../../shared/components/Toast';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { currentPlatform } from '../../../../shared/platform';
import {
  importStore,
  type StoryStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import type { SessionSuggestion } from '../../types';

const { suggestionState, recordNextStepOutcome, revertNextStepOutcome } = vi.hoisted(() => {
  const state: { list: ReadonlyArray<SessionSuggestion> } = { list: [] };
  return {
    suggestionState: state,
    recordNextStepOutcome: vi.fn(
      async (_params: { readonly fingerprint?: string }): Promise<string | null> => 'event',
    ),
    revertNextStepOutcome: vi.fn(
      async (_params: { readonly sessionId: string; readonly id: string }): Promise<void> =>
        undefined,
    ),
  };
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../useSessionSuggestions', () => ({
  useSessionSuggestions: () => suggestionState.list,
}));
vi.mock('../../useTranscriptMountProposals', () => ({
  useTranscriptMountProposals: () => [],
}));
vi.mock('../../useSuggestionActions', () => ({
  useSuggestionActions:
    () =>
    ({ suggestion }: { readonly suggestion: SessionSuggestion }) => ({
      primary: {
        label: `Act on ${suggestion.id}`,
        isDisabled: false,
        failureTitle: `Couldn't act on ${suggestion.id}`,
        run: async () => undefined,
      },
      onDismiss: null,
    }),
}));
vi.mock('../../useNextStepOutcomes', () => ({ recordNextStepOutcome, revertNextStepOutcome }));

import { NextStepSlot } from './index';

const SESSION = aSession();

const suggestionOf = ({
  id,
  title,
}: {
  readonly id: string;
  readonly title: string;
}): SessionSuggestion => ({
  id,
  kind: 'resolve-threads',
  priority: 0,
  band: 2,
  title,
  sessionId: SESSION.id,
  targetKey: null,
  fingerprint: `${id}:fingerprint`,
  payload: { eligibleThreadCount: 2 },
});

const FIRST = suggestionOf({ id: 'push-branch:first', title: 'Push ledger-core' });
const SECOND = suggestionOf({ id: 'push-branch:second', title: 'Push notify-relay' });

const undoKey = () => ({
  code: 'KeyZ',
  key: 'z',
  metaKey: currentPlatform() === 'darwin',
  ctrlKey: currentPlatform() !== 'darwin',
});

const setup = () =>
  render(
    <ToastProvider>
      <UndoToastBridge />
      <NextStepSlot session={SESSION} onSelectLens={vi.fn()} />
      <input aria-label="Draft" />
    </ToastProvider>,
  );

const dismissLead = () => {
  const [lead] = screen.getAllByRole('button', { name: 'Not now' });
  if (lead === undefined) {
    throw new Error('Expected a Not now button');
  }
  fireEvent.click(lead);
};

const pressUndo = async (target: HTMLElement) => {
  await act(async () => {
    fireEvent.keyDown(target, undoKey());
  });
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  suggestionState.list = [FIRST, SECOND];
  recordNextStepOutcome.mockClear();
  recordNextStepOutcome.mockImplementation(
    async (params) => `event:${params.fingerprint ?? 'none'}`,
  );
  revertNextStepOutcome.mockReset();
  revertNextStepOutcome.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('Not now with undo', () => {
  it('toasts Dismissed with an Undo button that carries the shortcut', () => {
    setup();

    dismissLead();

    expect(screen.queryByText('Push ledger-core')).toBeNull();
    screen.getByText('Dismissed');
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo.textContent).toContain(shortcutGlyphs('app.undo'));
  });

  it('brings the suggestion back from the Undo button and deletes the written dismissal', async () => {
    setup();
    dismissLead();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });

    screen.getByText('Push ledger-core');
    expect(revertNextStepOutcome).toHaveBeenCalledWith({
      sessionId: SESSION.id,
      id: 'event:push-branch:first:fingerprint',
    });
  });

  it('restores the last dismissed suggestion with the undo chord', async () => {
    setup();
    dismissLead();

    await pressUndo(document.body);

    screen.getByText('Push ledger-core');
    expect(revertNextStepOutcome).toHaveBeenCalledTimes(1);
  });

  it('restores several dismissals in reverse order', async () => {
    setup();
    dismissLead();
    dismissLead();
    expect(screen.queryByText('Push ledger-core')).toBeNull();
    expect(screen.queryByText('Push notify-relay')).toBeNull();

    await pressUndo(document.body);
    expect(screen.queryByText('Push ledger-core')).toBeNull();
    screen.getByText('Push notify-relay');

    await pressUndo(document.body);
    screen.getByText('Push ledger-core');
    expect(revertNextStepOutcome.mock.calls.map((call) => call[0].id)).toEqual([
      'event:push-branch:second:fingerprint',
      'event:push-branch:first:fingerprint',
    ]);
  });

  it('ignores the undo chord while a text field has focus', async () => {
    setup();
    dismissLead();

    await pressUndo(screen.getByRole('textbox', { name: 'Draft' }));

    expect(screen.queryByText('Push ledger-core')).toBeNull();
    expect(revertNextStepOutcome).not.toHaveBeenCalled();
  });

  it('keeps the suggestion away and reports the failure when the write cannot be deleted, then retries', async () => {
    const failure = new Error('database is locked');
    revertNextStepOutcome.mockRejectedValueOnce(failure);
    const reportError = vi.fn(async (_params: unknown) => undefined);
    useAppStore.setState({ reportError });
    setup();
    dismissLead();

    await pressUndo(document.body);

    expect(screen.queryByText('Push ledger-core')).toBeNull();
    expect(reportError).toHaveBeenCalledWith({
      title: "Couldn't undo the operation",
      error: failure,
    });

    await pressUndo(document.body);

    screen.getByText('Push ledger-core');
  });

  it('waits for the dismissal write before deleting it, so a fast undo cannot leave it behind', async () => {
    let finish: (id: string | null) => void = () => undefined;
    recordNextStepOutcome.mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          finish = resolve;
        }),
    );
    setup();
    dismissLead();

    fireEvent.keyDown(document.body, undoKey());
    expect(revertNextStepOutcome).not.toHaveBeenCalled();
    await act(async () => {
      finish('event:late');
    });

    expect(revertNextStepOutcome).toHaveBeenCalledWith({
      sessionId: SESSION.id,
      id: 'event:late',
    });
    screen.getByText('Push ledger-core');
  });

  it('restores without a delete when the dismissal was never written', async () => {
    recordNextStepOutcome.mockResolvedValueOnce(null);
    setup();
    dismissLead();

    await pressUndo(document.body);

    screen.getByText('Push ledger-core');
    expect(revertNextStepOutcome).not.toHaveBeenCalled();
  });

  it('drops the undo once the Overview is gone', async () => {
    const view = setup();
    dismissLead();
    view.rerender(
      <ToastProvider>
        <UndoToastBridge />
      </ToastProvider>,
    );

    await pressUndo(document.body);

    expect(revertNextStepOutcome).not.toHaveBeenCalled();
  });
});
