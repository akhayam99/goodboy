import type { AgentId, IsoDateTime, ProviderRunId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import type { TurnOutcome } from '../../utils/turnOutcome';
import { TurnChangesCard } from '../TurnChangesCard';
import { TurnFooter } from '../TurnFooter';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'usage' }>;
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
  readonly outcome?: TurnOutcome;
  readonly startedAt?: IsoDateTime | null;
  readonly previousRunId: ProviderRunId | null;
};

export const TranscriptUsage = ({
  item,
  sessionId,
  agentId,
  outcome,
  startedAt,
  previousRunId,
}: Props) => (
  <>
    {sessionId === null ? null : <TurnChangesCard sessionId={sessionId} runId={item.runId} />}
    <TurnFooter
      item={item}
      sessionId={sessionId}
      agentId={agentId}
      outcome={outcome}
      startedAt={startedAt}
      previousRunId={previousRunId}
    />
  </>
);
