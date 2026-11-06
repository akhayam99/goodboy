// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { createRef } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type AgentStatus,
  type IsoDateTime,
  type SessionId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import { useComposerQueue } from '.';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const AGENT = brandId<AgentId>({ value: 'agent-harborline' });

const routingStub = () => ({
  setSelectedProviderState: vi.fn(),
  setSelectedModelState: vi.fn(),
  setEffortState: vi.fn(),
});

let useAppStore: StoryStore;

type StatusParams = {
  readonly status: AgentStatus;
};

const statusLineOf = ({ status }: StatusParams): string | undefined => {
  useAppStore.setState({
    sessionPhaseRuns: { [SESSION]: [anAgent({ id: AGENT, sessionId: SESSION, status })] },
    agentQueue: {
      [AGENT]: [
        {
          id: 'q1',
          agentId: AGENT,
          content: 'Replay the webhook on notify-relay',
          attachments: [],
          override: undefined,
          status: 'queued',
          createdAt: brandId<IsoDateTime>({ value: '2026-11-06T09:00:00.000Z' }),
        },
      ],
    },
  });
  const { result } = renderHook(() =>
    useComposerQueue({
      sessionId: SESSION,
      agentId: AGENT,
      views: [],
      setValue: vi.fn(),
      setAttachments: vi.fn(),
      routing: routingStub(),
      wrapperRef: createRef<HTMLDivElement>(),
    }),
  );
  return result.current.queued.rows[0]?.statusText;
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({});
});

afterEach(() => {
  cleanup();
});

describe('useComposerQueue', () => {
  it('reads a row for a skipped step like a stopped one, since the drain refuses both', () => {
    expect(statusLineOf({ status: 'stopped' })).toBe('Sends when you Continue');
    expect(statusLineOf({ status: 'skipped' })).toBe('Sends when you Continue');
  });

  it('reads Waits for this turn while the agent can still take it', () => {
    expect(statusLineOf({ status: 'running' })).toBe('Waits for this turn');
  });
});
