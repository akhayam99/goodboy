import { vi } from 'vitest';
import { insertAgent, listAgentsForSessions, recordAgentStatus } from '@goodboy/db';
import type { AgentId, IsoDateTime, ProviderRunId, SessionId, TurnEvent } from '@goodboy/types';
import { brandedId } from '../../features/history/testing/brandedId';
import type { AgentInsertArgs } from '../../features/workflows/workflows';
import { storySpies, storySqlite } from '../../store/storyHarness';

const STEP_DONE = /<<step-done id="([^"]+)">>/;

export const stubProviderRouting = async (): Promise<void> => {
  const routing = await import('../../features/providers/routing');
  vi.mocked(routing.resolveProviderForTurn).mockResolvedValue({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-sonnet-4-5',
    reason: 'preferred',
    fallbackUsed: false,
  });
};

export const bindAgentRowsToSqlite = (): void => {
  storySpies.invokeAgentInsert.mockImplementation((run: AgentInsertArgs) =>
    insertAgent(storySqlite(), run),
  );
  storySpies.invokeAgentList.mockImplementation(async (sessionId: unknown) => {
    const wanted = brandedId<SessionId>({ value: String(sessionId) });
    return [...((await listAgentsForSessions(storySqlite(), [wanted])).get(wanted) ?? [])];
  });
  storySpies.invokeAgentUpdateStatus.mockImplementation((agentId: AgentId, fields) =>
    recordAgentStatus(storySqlite(), agentId, fields),
  );
};

type HeldTurn = {
  readonly runId: ProviderRunId;
  readonly agentId: AgentId;
  readonly finish: () => void;
};

type HeldTurnsParams = {
  readonly at: IsoDateTime;
  readonly opening: string;
};

type ProviderCallParams = {
  readonly runId: ProviderRunId;
  readonly prompt: string;
};

export type HeldTurns = {
  readonly turns: Array<HeldTurn>;
  readonly provider: (params: ProviderCallParams) => AsyncIterable<TurnEvent>;
  readonly finishAll: () => void;
};

export const createHeldTurns = ({ at, opening }: HeldTurnsParams): HeldTurns => {
  const turns: Array<HeldTurn> = [];
  const provider = ({ runId, prompt }: ProviderCallParams): AsyncIterable<TurnEvent> => {
    const agentId = brandedId<AgentId>({ value: prompt.match(STEP_DONE)?.[1] ?? '' });
    let finish: () => void = () => undefined;
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    turns.push({ runId, agentId, finish });
    return (async function* stream(): AsyncIterable<TurnEvent> {
      yield { kind: 'assistant_text', runId, delta: `${opening}\n`, at };
      await finished;
      yield { kind: 'assistant_text', runId, delta: `<<step-done id="${agentId}">>`, at };
    })();
  };
  storySpies.cancelTurn.mockImplementation(async (runId: unknown) => {
    turns.find((turn) => turn.runId === runId)?.finish();
  });
  storySpies.runTurn.mockImplementation(provider);
  return {
    turns,
    provider,
    finishAll: () => {
      for (const turn of turns) {
        turn.finish();
      }
    },
  };
};
