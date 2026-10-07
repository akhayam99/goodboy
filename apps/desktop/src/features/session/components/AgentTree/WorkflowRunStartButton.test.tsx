// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { isUserStart } from '../../../../shared/lib/userStarts';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { seedSessionWithMounts } from '../../../../__tests__/helpers/seedSessionWithMounts';
import { captureLocation } from '../../../../store/slices/navigation/captureLocation';
import { locationKey } from '../../../../store/slices/navigation/locationKey';
import { BOARD_PLACE, sessionPlace } from '../../../../store/slices/navigation/place';
import { WorkflowRunStartButton } from './WorkflowRunStartButton';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

let useAppStore: StoryStore;
let sessionId: SessionId;
let runId: WorkflowRunId;
let runCount = 0;

const runPage = () =>
  sessionPlace({ sessionId, lens: 'workflows', target: { kind: 'run', runId } });

const currentKey = (): string =>
  locationKey({ place: captureLocation({ state: useAppStore.getState() }).place });

const renderButton = ({ onStart }: { readonly onStart: () => void | Promise<void> }) =>
  render(
    <ToastProvider>
      <WorkflowRunStartButton
        variant="detail"
        sessionId={sessionId}
        runId={runId}
        blockReason={null}
        onStart={onStart}
      />
    </ToastProvider>,
  );

const pressStart = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  });
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ workspaces_with_unread: [] });
  sessionId = seedSessionWithMounts({ useAppStore });
  runCount += 1;
  runId = `run-harborline-${runCount}` as WorkflowRunId;
});

afterEach(cleanup);

describe('WorkflowRunStartButton', () => {
  it('toasts Run started with Follow when the start leaves the user elsewhere', async () => {
    useAppStore.getState().navigate({ to: BOARD_PLACE });
    renderButton({ onStart: async () => undefined });

    await pressStart();

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByText('Run started')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Follow' })).toBeDefined();
  });

  it('lands on the run page when Follow is pressed', async () => {
    useAppStore.getState().navigate({ to: BOARD_PLACE });
    renderButton({ onStart: async () => undefined });
    await pressStart();

    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));

    expect(currentKey()).toBe(`s/${sessionId}/workflows/${runId}`);
  });

  it('raises nothing when the start itself navigates to the run page', async () => {
    useAppStore.getState().navigate({ to: BOARD_PLACE });
    renderButton({
      onStart: () => useAppStore.getState().navigate({ to: runPage() }),
    });

    await pressStart();

    expect(currentKey()).toBe(`s/${sessionId}/workflows/${runId}`);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('raises nothing when the user is on the run page and the start navigates there again', async () => {
    useAppStore.getState().navigate({ to: runPage() });
    renderButton({
      onStart: () => useAppStore.getState().navigate({ to: runPage() }),
    });

    await pressStart();

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('offers Follow when the user moves on while a start that does not navigate is under way', async () => {
    useAppStore.getState().navigate({ to: runPage() });
    renderButton({
      onStart: async () => {
        useAppStore.getState().navigate({ to: BOARD_PLACE });
      },
    });

    await pressStart();

    expect(screen.getByText('Run started')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Follow' })).toBeDefined();
  });

  it('keeps the title but offers no Follow when the user is already on the run page', async () => {
    useAppStore.getState().navigate({ to: runPage() });
    renderButton({ onStart: async () => undefined });

    await pressStart();

    expect(screen.getByText('Run started')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
  });

  it('marks the run as a user start before the start runs', async () => {
    useAppStore.getState().navigate({ to: BOARD_PLACE });
    const seenDuringStart = vi.fn();
    renderButton({
      onStart: async () => {
        seenDuringStart(isUserStart(runId));
      },
    });
    expect(isUserStart(runId)).toBe(false);

    await pressStart();

    expect(seenDuringStart).toHaveBeenCalledWith(true);
  });

  it('keeps a failed start on the log and raises no Run started toast', async () => {
    useAppStore.getState().navigate({ to: BOARD_PLACE });
    const emitNotification = vi.fn(async () => undefined);
    useAppStore.setState({ emitNotification });
    renderButton({
      onStart: async () => {
        throw new Error('the worktree is locked');
      },
    });

    await pressStart();

    await waitFor(() =>
      expect(emitNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "The next step didn't start",
          body: expect.stringContaining('the worktree is locked'),
        }),
      ),
    );
    expect(screen.queryByText('Run started')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
