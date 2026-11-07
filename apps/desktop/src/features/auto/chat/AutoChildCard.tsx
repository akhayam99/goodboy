import type { AutoDelegation } from '@goodboy/db';
import type { AgentId, SessionId } from '@goodboy/types';
import { InteractiveRow, TruncatedText, cn, tintClasses } from '@goodboy/ui';
import { AgentKindChip } from '../../../shared/components/AgentKindChip';
import { ObjectMenuArea } from '../../actions/ObjectMenuArea';
import { autoChildCardFactsOf } from './autoChildCardFactsOf';
import type { DelegationCardModel } from './delegationCardOf';
import { DelegationClock } from './DelegationClock';

type Props = {
  readonly sessionId: SessionId;
  readonly delegation: AutoDelegation;
  readonly card: DelegationCardModel;
  readonly name: string;
  readonly revision: string | null;
  readonly onOpen: (agentId: AgentId) => void;
};

export const AutoChildCard = ({ sessionId, delegation, card, name, revision, onOpen }: Props) => {
  const facts = autoChildCardFactsOf({ card });
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
          radius="lg"
          frameClassName="bg-elevated"
          className="flex min-w-0 flex-col gap-1 px-3 py-1 text-meta"
        >
          <span className="flex min-w-0 items-center gap-2">
            <AgentKindChip kind={card.role} density="glyph" />
            <span className="shrink-0 text-muted-foreground">{card.roleLabel}</span>
            <TruncatedText
              isFocusable
              className="min-w-0 flex-1 truncate text-foreground"
              tooltip={card.task ?? name}
            >
              {name}
            </TruncatedText>
            {revision === null ? null : (
              <span className="shrink-0 text-muted-foreground">{revision}</span>
            )}
            <span className={cn('shrink-0', tintClasses(facts.tone).text)}>{facts.word}</span>
            <span className="flex w-16 shrink-0 justify-end">
              <DelegationClock agentId={card.childAgentId} isLive={card.status.isLive} />
            </span>
          </span>
          {card.result === null ? null : (
            <TruncatedText className="w-full min-w-0 text-meta text-muted-foreground">
              {card.result.outcomeLine?.text ?? card.result.summary ?? card.result.reasonText}
            </TruncatedText>
          )}
        </InteractiveRow>
      </ObjectMenuArea>
    </div>
  );
};
