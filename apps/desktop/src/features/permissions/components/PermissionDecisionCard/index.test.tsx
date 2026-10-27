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
  type PermissionRuleId,
  type ProviderRunId,
  type SessionId,
  type TurnEvent,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { TranscriptItem } from '../../../chat/utils/transcript-items';
import { PermissionDecisionCard } from './index';

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

const retryBlockedToolMock = vi.fn(async () => undefined);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  retryBlockedToolMock.mockReset().mockResolvedValue(undefined);
  useAppStore.setState({
    transcripts: { [AGENT_ID]: [decisionEvent] },
    retryBlockedTool: retryBlockedToolMock,
  });
});

afterEach(cleanup);

const renderCard = (item: DecisionItem) =>
  render(<PermissionDecisionCard item={item} sessionId={SESSION_ID} agentId={AGENT_ID} />);

describe('PermissionDecisionCard', () => {
  it('says in sentence case what was allowed for this call', () => {
    renderCard(makeItem({ scope: 'once' }));

    screen.getByText('Allowed pnpm test --filter ledger-core for this call');
    screen.getByText('The agent is continuing on its own.');
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('says in sentence case what was denied for this call', () => {
    renderCard(makeItem({ decision: 'deny', scope: 'once' }));

    screen.getByText('Denied pnpm test --filter ledger-core for this call');
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('names the session ban a never-allow wrote', () => {
    renderCard(makeItem({ decision: 'deny', scope: 'deny' }));

    screen.getByText('Denied Bash for the rest of this session');
  });

  it('names the rule place of an allow and shows the rule id', () => {
    renderCard(makeItem({ ruleId: brandId<PermissionRuleId>({ value: 'rule-42' }) }));

    screen.getByText('Allowed Bash in this workspace');
    screen.getByText('rule-42');
  });

  it('offers Continue, in a warning tone, only while nothing resumed the agent', async () => {
    renderCard(makeItem());

    screen.getByText('Stopped before your answer.');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });
    expect(retryBlockedToolMock).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      toolName: 'Bash',
    });
    screen.getByText('Continuing');
  });

  it('offers no Continue once the agent runs again', () => {
    useAppStore.setState({
      agentTurnState: { [AGENT_ID]: { kind: 'running', runId: RUN_ID, startedAt: STORY_NOW } },
    });

    renderCard(makeItem());

    expect(screen.queryByText('Stopped before your answer.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('offers no Continue for a decision a later turn already moved past', () => {
    useAppStore.setState({
      transcripts: {
        [AGENT_ID]: [decisionEvent, { kind: 'done', runId: RUN_ID, at: AT }],
      },
    });

    renderCard(makeItem());

    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('offers no Continue without a session and an agent', () => {
    render(<PermissionDecisionCard item={makeItem()} sessionId={null} agentId={null} />);

    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('falls back to the tool name when the request carried no subject', () => {
    renderCard(makeItem({ scope: 'once', subject: null }));

    screen.getByText('Allowed Bash for this call');
  });
});
