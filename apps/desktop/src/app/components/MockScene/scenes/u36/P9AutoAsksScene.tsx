import { useEffect, useState } from 'react';
import { brandId, type AgentId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { C07AutoFrame } from '../u25/c07/C07AutoFrame';
import type { C07Seed } from '../u25/c07/c07AutoSeed';
import { IMPLEMENTER_ID, TESTER_ID } from '../u24/autoSceneSeed';

const WORKING: C07Seed = { state: 'working', place: 'auto' };

const AT = brandId<IsoDateTime>({ value: '2026-11-06T12:30:00.000Z' });

const ASKS = [
  { agentId: IMPLEMENTER_ID, command: 'pnpm add -D vitest-fetch-mock', id: 'implementer' },
  { agentId: TESTER_ID, command: 'pnpm --filter payments-api test:retry', id: 'tester' },
] as const;

type AskParams = {
  readonly agentId: AgentId;
  readonly command: string;
  readonly id: string;
};

const seedAsk = ({ agentId, command, id }: AskParams): void => {
  const runId = brandId<ProviderRunId>({ value: `mock-p9-run-${id}` });
  useAppStore.setState((state) => ({
    agentTurnState: {
      ...state.agentTurnState,
      [agentId]: { kind: 'blocked', runId, blockedAt: AT },
    },
    transcripts: {
      ...state.transcripts,
      [agentId]: [
        ...(state.transcripts[agentId] ?? []),
        {
          kind: 'permission_request',
          runId,
          toolUseId: `mock-p9-ask-${id}`,
          toolName: 'Bash',
          input: { command },
          at: AT,
        },
      ],
    },
  }));
};

export const P9AutoAsksScene = () => {
  const [isSeeded, setIsSeeded] = useState(false);
  useEffect(() => {
    if (isSeeded) {
      return;
    }
    for (const ask of ASKS) {
      seedAsk(ask);
    }
    setIsSeeded(true);
  }, [isSeeded]);
  return <C07AutoFrame seed={WORKING} />;
};
