import type { AutoDelegation } from '@goodboy/db';
import type { AgentId, SessionId } from '@goodboy/types';
import { ActivityMeta, ActivityRow, InteractiveRow, TruncatedText, WorkNode } from '@goodboy/ui';
import { AgentRoleChip } from '../../session/AgentRoleChip';
import { activityStateWordOf } from '../../workTreeModel/activityStateWordOf';
import { ACTIVITY_TONE_OF_NODE } from '../../workTreeModel/activityToneOfNode';
import { ObjectMenuArea } from '../../actions/ObjectMenuArea';
import { autoChildCardFactsOf } from './autoChildCardFactsOf';
import type { DelegationCardModel } from './delegationCardOf';
import { delegationNodeOf } from './delegationNodeOf';
import { DelegationClock } from './DelegationClock';

type Props = {
  readonly sessionId: SessionId;
  readonly delegation: AutoDelegation;
  readonly card: DelegationCardModel;
  readonly name: string;
  readonly revision: string | null;
  readonly costUsd: number;
  readonly onOpen: (agentId: AgentId) => void;
};

export const AutoChildCard = ({
  sessionId,
  delegation,
  card,
  name,
  revision,
  costUsd,
  onOpen,
}: Props) => {
  const facts = autoChildCardFactsOf({ card });
  const node = delegationNodeOf({ status: card.status });
  const tone = ACTIVITY_TONE_OF_NODE[node];
  const open = () => onOpen(card.childAgentId);
  return (
    <div data-auto-child-card={delegation.id} data-state={card.status.word} className="min-w-0">
      <ObjectMenuArea
        target={{ kind: 'agent', sessionId, agentId: card.childAgentId }}
        anchorKey={`auto-child:${delegation.id}`}
      >
        <InteractiveRow
          label={`Open ${name}, ${facts.word}`}
          isSelected={false}
          onOpen={open}
          className="flex min-w-0 flex-col"
        >
          <span className="flex h-8 min-w-0">
            <ActivityRow
              density="feed"
              tone={tone}
              marker={
                <WorkNode
                  look="quiet"
                  size="sm"
                  state={node}
                  label={facts.word}
                  mark={{ kind: 'dot' }}
                />
              }
              glyph={
                <AgentRoleChip
                  sessionId={sessionId}
                  agentId={card.childAgentId}
                  kind={card.role}
                  position="Subagent"
                  costUsd={costUsd}
                  onClick={open}
                />
              }
              text={
                <span className="flex min-w-0 items-center gap-2">
                  <TruncatedText isFocusable className="min-w-0" tooltip={card.task ?? name}>
                    {name}
                  </TruncatedText>
                  {revision === null ? null : (
                    <span className="shrink-0 text-muted-foreground">{revision}</span>
                  )}
                </span>
              }
              meta={
                <ActivityMeta
                  density="feed"
                  columns={['state', 'time']}
                  state={activityStateWordOf({ tone, word: facts.word })}
                  time={
                    <DelegationClock
                      agentId={card.childAgentId}
                      isLive={card.status.isLive}
                      className={card.status.isLive ? 'text-info' : undefined}
                    />
                  }
                />
              }
            />
          </span>
          {card.result === null ? null : (
            <span className="flex min-w-0 gap-2 pb-1 pl-3 pr-2">
              <span aria-hidden className="w-10 shrink-0" />
              <TruncatedText className="min-w-0 flex-1 text-meta text-muted-foreground">
                {card.result.outcomeLine?.text ?? card.result.summary ?? card.result.reasonText}
              </TruncatedText>
            </span>
          )}
        </InteractiveRow>
      </ObjectMenuArea>
    </div>
  );
};
