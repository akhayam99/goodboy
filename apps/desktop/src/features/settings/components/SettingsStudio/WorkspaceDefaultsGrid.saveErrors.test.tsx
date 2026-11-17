// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { WorkspaceOverridesPatch } from '../../../../store/slices/overrides/patchWorkspaceOverrides';
import { DEFAULT_BRANCH_PREFIX } from '../../settings';
import { WorkspaceBranchNamingBand } from './WorkspaceBranchNamingBand';
import { WorkspaceDefaultsGrid } from './WorkspaceDefaultsGrid';
import { WorkspaceReviewRepliesSection } from './WorkspaceReviewRepliesSection';

const WORKSPACE = aWorkspace({ name: 'Harborline' });

const Pages = () => (
  <>
    <WorkspaceDefaultsGrid workspaceId={WORKSPACE.id} />
    <WorkspaceBranchNamingBand workspaceId={WORKSPACE.id} />
    <WorkspaceReviewRepliesSection workspaceId={WORKSPACE.id} />
  </>
);

type Patch = {
  readonly workspaceId: typeof WORKSPACE.id;
  readonly patch: WorkspaceOverridesPatch;
};

type Call = {
  readonly patch: Patch;
  readonly answer: (params: { readonly isOk: boolean }) => Promise<void>;
};

let useAppStore: StoryStore;
let calls: Array<Call> = [];
const reportError = vi.fn(async () => undefined);

const holdPatches = () => {
  const real = useAppStore.getState().patchWorkspaceOverrides;
  useAppStore.setState({
    reportError,
    patchWorkspaceOverrides: (patch: Patch) =>
      new Promise<void>((resolve, reject) => {
        calls.push({
          patch,
          answer: async ({ isOk }) => {
            if (!isOk) {
              reject(new Error('disk is offline'));
              return;
            }
            await real(patch);
            resolve();
          },
        });
      }),
  });
};

type AnswerParams = {
  readonly index: number;
  readonly isOk: boolean;
};

const answer = async ({ index, isOk }: AnswerParams) => {
  await waitFor(() => expect(calls.length).toBeGreaterThan(index));
  await act(async () => {
    await calls[index]?.answer({ isOk });
  });
};

const attribution = () => screen.getByRole('switch', { name: 'Sign replies' });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  calls = [];
  reportError.mockClear();
  await resetStoryStore();
  await openStorySqlite();
  useAppStore.setState({ workspaces: [WORKSPACE] });
  holdPatches();
});

afterEach(cleanup);

describe('WorkspaceDefaultsGrid save errors', () => {
  it('puts a switch back and writes the error under its row, and Retry saves it', async () => {
    render(<Pages />);

    fireEvent.click(attribution());
    expect(attribution().getAttribute('aria-checked')).toBe('false');
    await answer({ index: 0, isOk: false });

    expect(attribution().getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain("Couldn't save. Still On.");
    expect(reportError).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.queryByRole('alert')).toBeNull();
    await answer({ index: 1, isOk: true });

    expect(calls[1]?.patch).toEqual({
      workspaceId: WORKSPACE.id,
      patch: { attributionFooter: false },
    });
    await waitFor(() => expect(attribution().getAttribute('aria-checked')).toBe('false'));
    expect(useAppStore.getState().workspaceOverrides[WORKSPACE.id]?.attributionFooter).toBe(false);
  });

  it('puts a choice back and Retry saves the pick that failed', async () => {
    render(<Pages />);

    const tabs = screen.getByRole('tablist', { name: 'Reply length' });
    const picked = tabs.querySelectorAll('[role="tab"]')[2];
    if (picked === undefined) {
      throw new Error('no third reply length');
    }
    fireEvent.click(picked);
    await answer({ index: 0, isOk: false });

    expect(picked.getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('alert').textContent).toContain("Couldn't save. Still Normal.");

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await answer({ index: 1, isOk: true });

    expect(calls[1]?.patch.patch).toEqual({ defaultVerbosity: 'verbose' });
    await waitFor(() => expect(picked.getAttribute('aria-selected')).toBe('true'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('puts a text field back to the saved value and Retry saves the typed one', async () => {
    render(<Pages />);

    const prefix = screen.getByRole('textbox', { name: 'Branch prefix' });
    fireEvent.change(prefix, { target: { value: 'offline' } });
    fireEvent.keyDown(prefix, { key: 'Enter' });
    await answer({ index: 0, isOk: false });

    expect(prefix).toHaveProperty('value', DEFAULT_BRANCH_PREFIX);
    expect(screen.getByRole('alert').textContent).toContain(
      `Couldn't save. Still ${DEFAULT_BRANCH_PREFIX}.`,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await answer({ index: 1, isOk: true });

    expect(calls[1]?.patch.patch).toEqual({ defaultBranchPrefix: 'offline' });
    await waitFor(() => expect(prefix).toHaveProperty('value', 'offline'));
  });

  it('keeps a failed reset under its row and Retry resets', async () => {
    render(<Pages />);
    fireEvent.click(attribution());
    await answer({ index: 0, isOk: true });
    await waitFor(() => expect(attribution().getAttribute('aria-checked')).toBe('false'));

    fireEvent.click(screen.getByRole('button', { name: 'Reset Sign replies to default' }));
    await answer({ index: 1, isOk: false });

    expect(screen.getByRole('alert').textContent).toContain("Couldn't save. Still Off.");
    expect(attribution().getAttribute('aria-checked')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await answer({ index: 2, isOk: true });

    await waitFor(() => expect(attribution().getAttribute('aria-checked')).toBe('true'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps only the latest change when an older one fails after it', async () => {
    render(<Pages />);
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    const parallel = screen.getByRole('switch', { name: 'Parallel agents' });

    fireEvent.click(parallel);
    fireEvent.click(parallel);
    expect(parallel.getAttribute('aria-checked')).toBe('false');

    await answer({ index: 0, isOk: false });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(parallel.getAttribute('aria-checked')).toBe('false');

    await answer({ index: 1, isOk: true });
    expect(calls[1]?.patch.patch).toEqual({ parallelAgents: false });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('shows a toast only when the page closed before the failure', async () => {
    const { unmount } = render(<Pages />);

    fireEvent.click(attribution());
    unmount();
    await answer({ index: 0, isOk: false });

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't save sign replies",
        workspaceId: WORKSPACE.id,
      }),
    );
  });

  it('drops a failure that a newer change replaced after the page closed', async () => {
    const first = render(<Pages />);
    fireEvent.click(attribution());
    first.unmount();
    render(<Pages />);
    fireEvent.click(attribution());

    await answer({ index: 0, isOk: false });
    await answer({ index: 1, isOk: true });

    expect(reportError).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
