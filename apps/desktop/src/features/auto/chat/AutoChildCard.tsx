import { useState } from 'react';
import type { AutoDelegation } from '@goodboy/db';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { Button, Notice, TruncatedText, formatError, tintClasses } from '@goodboy/ui';
import { AgentKindChip } from '../../../shared/components/AgentKindChip';
import { useAppStore } from '../../../store';
import { autoChildCardFactsOf } from './autoChildCardFactsOf';
import type { DelegationCardModel } from './delegationCardOf';
import { DelegationClock } from './DelegationClock';
import { useChildLive } from './hooks/useChildLive';

type Props = {
  readonly sessionId: SessionId;
  readonly delegation: AutoDelegation;
  readonly card: DelegationCardModel;
  readonly agent: Agent | null;
  readonly name: string;
  readonly revision: string | null;
  readonly onOpen: (agentId: AgentId) => void;
};

export const AutoChildCard = ({
  sessionId,
  delegation,
  card,
  agent,
  name,
  revision,
  onOpen,
}: Props) => {
  const cancelCurrentTurn = useAppStore((state) => state.cancelCurrentTurn);
  const [isStopping, setIsStopping] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const live = useChildLive({ delegation, agent });
  const facts = autoChildCardFactsOf({ card, live });
  const stop = async (): Promise<void> => {
    if (isStopping) {
      return;
    }
    setIsStopping(true);
    setFailure(null);
    try {
      await cancelCurrentTurn(sessionId, card.childAgentId, 'user');
    } catch (error) {
      setFailure(formatError(error));
    } finally {
      setIsStopping(false);
    }
  };
  const meta = [card.roleLabel, card.model].filter((part) => part !== null).join(' · ');
  return (
    <div
      data-auto-child-card={delegation.id}
      data-state={card.status.word}
      className="grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 rounded-lg bg-elevated p-3 text-meta"
    >
      <AgentKindChip kind={card.role} density="glyph" />
      <span className="flex min-w-0 items-center gap-2">
        <TruncatedText className="min-w-0 truncate text-foreground" tooltip={card.task ?? name}>
          {name}
        </TruncatedText>
        {revision === null ? null : (
          <span className="shrink-0 text-muted-foreground">{revision}</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <Button
          variant="quiet"
          size="xs"
          aria-label={`Open ${name}`}
          onClick={() => onOpen(card.childAgentId)}
        >
          Open
        </Button>
        {facts.canStop ? (
          <Button
            variant="quiet"
            size="xs"
            isBusy={isStopping}
            aria-label={`Stop ${name}`}
            onClick={() => void stop()}
          >
            Stop
          </Button>
        ) : null}
      </span>
      <span className="col-start-2 col-span-2 flex min-w-0 items-center gap-2" role="status">
        <span className={tintClasses(facts.tone).text}>{facts.word}</span>
        <DelegationClock agentId={card.childAgentId} isLive={card.status.isLive} />
        {meta === '' ? null : (
          <span className="min-w-0 truncate text-muted-foreground">{meta}</span>
        )}
      </span>
      {facts.activity === null ? null : (
        <p className="col-start-2 col-span-2 min-w-0 truncate text-muted-foreground">
          {facts.activity}
        </p>
      )}
      {failure === null ? null : (
        <div className="col-span-3">
          <Notice
            tone="danger"
            placement="inline"
            role="alert"
            title="Couldn't stop the agent"
            body={failure}
          />
        </div>
      )}
    </div>
  );
};
