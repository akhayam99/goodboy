import { useEffect } from 'react';
import { brandId, type AgentId, type ProviderRunId, type SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { TranscriptErrorRow } from '../../../../../features/chat/components/TranscriptCards/TranscriptErrorRow';
import { sceneClock } from '../../sceneClock';

const ANCHOR = '2026-09-07T13:15:00.000Z';
const RESET_AT = '2026-09-07T18:40:00.000Z';

const RUN_ID = brandId<ProviderRunId>({ value: 'mock-run-harborline-export' });
const AGENT_ID = brandId<AgentId>({ value: 'mock-agent-harborline-export' });
const SESSION_ID = brandId<SessionId>({ value: 'mock-session-harborline-export' });

const MESSAGE = "You've hit your usage limit. Try again at 18:40.";

export const LimitContinueStage = () => {
  useEffect(() => {
    useAppStore.getState().recordLimitStop({
      stop: {
        runId: RUN_ID,
        agentId: AGENT_ID,
        sessionId: SESSION_ID,
        provider: 'anthropic',
        resetAtMs: sceneClock({ anchor: ANCHOR }).ms({ at: RESET_AT }),
        isScheduled: false,
        input: {
          sessionId: SESSION_ID,
          agentId: AGENT_ID,
          content: 'finish the Harborline export',
        },
      },
    });
    return () => useAppStore.getState().clearAgentLimitStops({ agentId: AGENT_ID });
  }, []);

  return (
    <main className="flex h-screen items-center justify-center bg-background text-foreground">
      <div className="flex w-full max-w-prose flex-col gap-3 p-6">
        <TranscriptErrorRow message={MESSAGE} runId={RUN_ID} onRetry={() => undefined} />
      </div>
    </main>
  );
};
