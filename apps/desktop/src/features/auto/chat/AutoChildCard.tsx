import type { AutoDelegation } from '@goodboy/db';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { InteractiveRow, TruncatedText, tintClasses } from '@goodboy/ui';
import { AgentKindChip } from '../../../shared/components/AgentKindChip';
import { ObjectMenuArea } from '../../actions/ObjectMenuArea';
import { AgentModelLine } from '../../providers/modelLine/AgentModelLine';
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
  const live = useChildLive({ delegation, agent });
  const facts = autoChildCardFactsOf({ card, live });
  return (
    <div data-auto-child-card={delegation.id} data-state={card.status.word} className="min-w-0">
      <ObjectMenuArea
        target={{ kind: 'agent', sessionId, agentId: card.childAgentId }}
        anchorKey={`auto-child:${delegation.id}`}
      >
        <InteractiveRow
          label={`Open ${name}, ${facts.word}`}
          isSelected={false}
          onOpen={() => onOpen(card.childAgentId)}
          frameClassName="rounded-lg bg-elevated"
          className="grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1 p-3 text-meta"
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
          <span className="col-start-2 flex min-w-0 items-center gap-2">
            <span className={tintClasses(facts.tone).text}>{facts.word}</span>
            <DelegationClock agentId={card.childAgentId} isLive={card.status.isLive} />
            <span className="min-w-0 truncate text-muted-foreground">{card.roleLabel}</span>
            <AgentModelLine line={card.modelLine} className="pointer-events-auto" />
          </span>
          {facts.activity === null ? null : (
            <span className="col-start-2 min-w-0 truncate text-muted-foreground">
              {facts.activity}
            </span>
          )}
        </InteractiveRow>
      </ObjectMenuArea>
    </div>
  );
};
