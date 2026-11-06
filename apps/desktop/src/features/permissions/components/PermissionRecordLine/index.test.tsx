// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
  type TurnEvent,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { TranscriptItem } from '../../../chat/utils/transcript-items';
import { PermissionRecordLine } from './index';

const SESSION_ID = brandId<SessionId>({ value: 'sess' });
const AGENT_ID = brandId<AgentId>({ value: 'agent' });
const RUN_ID = brandId<ProviderRunId>({ value: 'run-1' });
const AT = brandId<IsoDateTime>({ value: '2026-10-24T09:00:00.000Z' });

type DecisionItem = Extract<TranscriptItem, { kind: 'permission_decision' }>;

const makeItem = (over: Partial<DecisionItem> = {}): DecisionItem => ({
  kind: 'permission_decision',
  key: 'perm-dec-tu-7',
  at: AT,
  toolUseId: 'tu-7',
  toolName: 'Bash',
  subject: 'pnpm test --filter ledger-core',
  runId: RUN_ID,
  decision: 'allow',
  scope: 'workspace',
  ruleId: null,
  decidedBy: 'user',
  isRecordLine: true,
  ...over,
});

const decisionEvent: TurnEvent = {
  kind: 'permission_decision',
  runId: RUN_ID,
  toolUseId: 'tu-7',
  decision: 'allow',
  scope: 'workspace',
  ruleId: null,
  decidedBy: 'user',
  at: AT,
};

let store: StoryStore;
const retryBlockedToolMock = vi.fn(async () => undefined);

const renderLine = (item: DecisionItem) =>
  render(<PermissionRecordLine item={item} sessionId={SESSION_ID} agentId={AGENT_ID} />);

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  retryBlockedToolMock.mockReset().mockResolvedValue(undefined);
  store.setState({
    retryBlockedTool: retryBlockedToolMock,
    transcripts: { [AGENT_ID]: [decisionEvent] },
    agentTurnState: { [AGENT_ID]: { kind: 'blocked', runId: RUN_ID, blockedAt: AT } },
  });
});

afterEach(cleanup);

describe('PermissionRecordLine', () => {
  it('keeps Continue on an always allow whose turn never started', async () => {
    renderLine(makeItem());

    screen.getByText('Stopped before your answer.');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });

    expect(retryBlockedToolMock).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      toolName: 'Bash',
      toolUseId: 'tu-7',
    });
  });

  it('offers nothing once the turn went on', () => {
    store.setState({
      agentTurnState: { [AGENT_ID]: { kind: 'running', runId: RUN_ID, startedAt: AT } },
    });

    renderLine(makeItem());

    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('offers nothing when something came after the answer', () => {
    store.setState({
      transcripts: {
        [AGENT_ID]: [decisionEvent, { kind: 'user_text', runId: RUN_ID, text: 'Go on', at: AT }],
      },
    });

    renderLine(makeItem());

    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('stays a plain line for a once answer', () => {
    renderLine(makeItem({ scope: 'once' }));

    screen.getByText('Allowed pnpm test --filter ledger-core');
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });
});
