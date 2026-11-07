// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type WorkflowRunId,
} from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { BlockedStepAnswer } from '../ChatInput/hooks/useBlockedStepAnswer';
import { ConversationDock } from './index';

const AGENT_ID = brandId<AgentId>({ value: 'agent-tester' });
const RUN_ID = brandId<ProviderRunId>({ value: 'run-ask' });
const AT = brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' });
const session = aSession({ goal: 'Reinstall dependencies in payments-api' });

const stepOf = ({
  isComposerBlocked,
}: {
  readonly isComposerBlocked: boolean;
}): BlockedStepAnswer => ({
  agentId: AGENT_ID,
  runId: brandId<WorkflowRunId>({ value: 'run-1' }),
  isSending: false,
  isComposerBlocked,
  error: null,
  send: async () => undefined,
});

type RenderParams = {
  readonly hasAsks: boolean;
  readonly step: BlockedStepAnswer;
};

const renderDock = ({ hasAsks, step }: RenderParams) =>
  render(
    <ConversationDock
      session={session}
      agentId={AGENT_ID}
      lead={undefined}
      hasAsks={hasAsks}
      isMessageTyped={false}
      live={null}
      stop={null}
      isStopArmed={false}
      failure={null}
      step={step}
    />,
  );

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [session],
    sessionPhaseRuns: { [session.id]: [anAgent({ id: AGENT_ID, status: 'blocked' })] },
  });
});

afterEach(() => {
  cleanup();
});

describe('the step line of the dock', () => {
  it('shows the one line with a live Continue when nothing else holds the composer', () => {
    renderDock({ hasAsks: false, step: stepOf({ isComposerBlocked: false }) });

    screen.getByText('Not finished');
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty('disabled', false);
  });

  it('leaves the line out while an ask is open', () => {
    useAppStore.setState({
      agentTurnState: { [AGENT_ID]: { kind: 'blocked', runId: RUN_ID, blockedAt: AT } },
      transcripts: {
        [AGENT_ID]: [
          {
            kind: 'permission_request',
            runId: RUN_ID,
            toolUseId: 'tool-1',
            toolName: 'Bash',
            input: { command: 'rm -rf node_modules' },
            at: AT,
          },
        ],
      },
    });
    renderDock({ hasAsks: true, step: stepOf({ isComposerBlocked: false }) });

    screen.getByText('rm -rf node_modules');
    expect(screen.queryByText('Not finished')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('disables Continue when the composer is blocked and keeps Retry', () => {
    renderDock({ hasAsks: false, step: stepOf({ isComposerBlocked: true }) });

    expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveProperty('disabled', false);
  });
});
