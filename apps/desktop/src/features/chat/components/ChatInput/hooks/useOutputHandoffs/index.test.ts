// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../../shared/lib/db', async () =>
  (await import('../../../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { nextAgentId } from '@goodboy/types/testing';
import type { AgentId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import { outputHandoffOf, type OutputHandoff } from '../../../../../../shared/utils/outputHandoff';
import type { AttachOutputHandoffsParams } from '../useAttachments';
import { useOutputHandoffs } from '.';

const AGENT_A = nextAgentId();
const AGENT_B = nextAgentId();

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const handoffOf = (): OutputHandoff =>
  outputHandoffOf({
    subject: 'Check posting drift',
    outcome: 'Exit 1',
    projectName: 'ledger-core',
    branch: 'nw/fix-settlement-replay',
    output: 'FAIL postings',
  });

type MountParams = {
  readonly agentId: AgentId | null;
  readonly isReady: boolean;
  readonly attach: (params: AttachOutputHandoffsParams) => Promise<boolean>;
};

const mount = ({ agentId, isReady, attach }: MountParams) => {
  const wrapperRef = { current: document.createElement('div') };
  return renderHook(
    (props: { readonly agentId: AgentId | null; readonly isReady: boolean }) =>
      useOutputHandoffs({
        selectedAgentId: props.agentId,
        isReady: props.isReady,
        wrapperRef,
        attachOutputHandoffs: attach,
      }),
    { initialProps: { agentId, isReady } },
  );
};

describe('useOutputHandoffs', () => {
  it('attaches a queued handoff once the composer is ready and then clears it', async () => {
    const handoff = handoffOf();
    const attach = vi.fn(async (_params: AttachOutputHandoffsParams) => true);
    useAppStore.getState().queueOutputHandoff({ agentId: AGENT_A, handoff });

    mount({ agentId: AGENT_A, isReady: true, attach });

    await waitFor(() => expect(useAppStore.getState().outputHandoffs[AGENT_A]).toEqual([]));
    expect(attach).toHaveBeenCalledTimes(1);
    expect(attach).toHaveBeenCalledWith({ agentId: AGENT_A, handoffs: [handoff] });
  });

  it('waits while the stored attachments are still being restored', async () => {
    const attach = vi.fn(async (_params: AttachOutputHandoffsParams) => true);
    useAppStore.getState().queueOutputHandoff({ agentId: AGENT_A, handoff: handoffOf() });

    const { rerender } = mount({ agentId: AGENT_A, isReady: false, attach });
    expect(attach).not.toHaveBeenCalled();

    rerender({ agentId: AGENT_A, isReady: true });

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
  });

  it('leaves the handoff queued for another agent', () => {
    const attach = vi.fn(async (_params: AttachOutputHandoffsParams) => true);
    useAppStore.getState().queueOutputHandoff({ agentId: AGENT_B, handoff: handoffOf() });

    mount({ agentId: AGENT_A, isReady: true, attach });

    expect(attach).not.toHaveBeenCalled();
    expect(useAppStore.getState().outputHandoffs[AGENT_B]).toHaveLength(1);
  });

  it('keeps the handoff when the composer moved to another agent before it landed', async () => {
    const attach = vi.fn(async (_params: AttachOutputHandoffsParams) => false);
    useAppStore.getState().queueOutputHandoff({ agentId: AGENT_A, handoff: handoffOf() });

    mount({ agentId: AGENT_A, isReady: true, attach });

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    await act(async () => undefined);
    expect(useAppStore.getState().outputHandoffs[AGENT_A]).toHaveLength(1);
  });

  it('attaches a handoff queued later, without repeating the first', async () => {
    const attach = vi.fn(async (_params: AttachOutputHandoffsParams) => true);
    mount({ agentId: AGENT_A, isReady: true, attach });

    act(() => {
      useAppStore.getState().queueOutputHandoff({ agentId: AGENT_A, handoff: handoffOf() });
    });
    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    act(() => {
      useAppStore.getState().queueOutputHandoff({ agentId: AGENT_A, handoff: handoffOf() });
    });

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(2));
    expect(attach.mock.calls[1]?.[0].handoffs).toHaveLength(1);
  });
});
