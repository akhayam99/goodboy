import { useEffect, useState } from 'react';
import {
  brandId,
  type Agent,
  type AgentId,
  type ProviderRunId,
  type Session,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { PageColumn } from '@goodboy/ui';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { AssistantText } from '../../../../../features/chat/components/TranscriptCards/AssistantText';
import { ToolCallCard } from '../../../../../features/chat/components/ToolCallCard';
import type { TranscriptItem } from '../../../../../features/chat/utils/transcript-items';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-22T09:30:00.000Z' });

const NOW = clock.iso({ at: '2026-10-22T09:30:00.000Z' });
const EARLIER = clock.iso({ at: '2026-10-22T09:00:00.000Z' });

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'mock-command-card-workspace-northwind' });
const SESSION_ID = brandId<SessionId>({ value: 'mock-command-card-session-settlement' });
const AGENT_ID = brandId<AgentId>({ value: 'mock-command-card-agent-implementer' });
const RUN_ID = brandId<ProviderRunId>({ value: 'mock-command-card-run' });
const WORKTREE = '/mock/northwind/payments-api-settlement';

const SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Fix the settlement replay in payments-api',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: EARLIER,
  updatedAt: NOW,
};

const AGENT: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'Fix the settlement replay',
  status: 'completed',
  kind: 'implementer',
  startedAt: EARLIER,
  completedAt: NOW,
};

const OUTPUT = [
  '> payments-api@4.2.0 test',
  '> vitest run settlement',
  '',
  ' FAIL  src/settlement/replay.test.ts > replays a batch once',
  'AssertionError: expected 3 to be 2',
  '   at src/settlement/replay.test.ts:41:23',
  '',
  ' Test Files  1 failed | 11 passed (12)',
  '      Tests  1 failed | 88 passed (89)',
].join('\n');

const FAILED_RUN: Extract<TranscriptItem, { kind: 'tool_call' }> = {
  kind: 'tool_call',
  key: 'mock-command-card-tool',
  toolUseId: 'mock-command-card-tool-use',
  toolName: 'Bash',
  input: { command: 'pnpm --filter payments-api test -- --run settlement' },
  output: OUTPUT,
  isError: true,
  ended: true,
  runId: RUN_ID,
  startedAt: EARLIER,
  endedAt: NOW,
};

const MESSAGE = [
  'The replay test still fails on the second batch. Apply the pending migration and run it again:',
  '',
  '```bash',
  'pnpm --filter payments-api migrate:up',
  'pnpm --filter payments-api test -- --run settlement',
  '```',
].join('\n');

export const CommandCardStage = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    useAppStore.setState({
      sessions: [SESSION],
      currentSessionId: SESSION_ID,
      sessionPhaseRuns: { [SESSION_ID]: [AGENT] },
      selectedAgentId: { [SESSION_ID]: AGENT_ID },
      sessionWorktrees: { [SESSION_ID]: [WORKTREE] },
    });
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const timer = window.setTimeout(() => {
      window.document
        .querySelector<HTMLButtonElement>('[data-scene="command-card"] [aria-expanded="false"]')
        ?.click();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <ToastProvider>
      <main data-scene="command-card" className="min-h-screen bg-background text-foreground">
        <PageColumn className="flex flex-col gap-4 py-5">
          <ToolCallCard
            item={FAILED_RUN}
            sessionId={SESSION_ID}
            agentId={AGENT_ID}
            workingDir={WORKTREE}
          />
          <AssistantText
            text={MESSAGE}
            sessionId={SESSION_ID}
            agentId={AGENT_ID}
            runId={RUN_ID}
            itemKey="mock-command-card-text"
            workingDir={WORKTREE}
          />
        </PageColumn>
      </main>
    </ToastProvider>
  );
};
