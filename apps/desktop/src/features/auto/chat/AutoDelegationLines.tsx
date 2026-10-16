import type { AutoDelegation } from '@goodboy/db';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { Button, WorkNode } from '@goodboy/ui';
import { AgentKindChip } from '../../../shared/components/AgentKindChip';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { artifactLinksOf } from './artifactLinksOf';
import { AutoPlanAsk } from './AutoPlanAsk';
import { cardTitleOf } from './cardTitleOf';
import { confirmLineOf } from './confirmLineOf';
import { delegationCardOf } from './delegationCardOf';
import { DelegationConfirmRow } from './DelegationConfirmRow';
import { delegationNodeOf } from './railRowsOf';
import { revisionWordOf } from './revisionWordOf';
import { useDelegationDecision } from './useDelegationDecision';

type Props = {
  readonly sessionId: SessionId;
  readonly view: AutoTreeView;
  readonly delegations: ReadonlyArray<AutoDelegation>;
  readonly agents: ReadonlyArray<Agent>;
  readonly onOpenChild: (agentId: AgentId) => void;
  readonly onOpenArtifact: (artifactId: string) => void;
};

export const AutoDelegationLines = ({
  sessionId,
  view,
  delegations,
  agents,
  onOpenChild,
  onOpenArtifact,
}: Props) => {
  const decision = useDelegationDecision();
  return (
    <ul aria-label="Delegations" className="flex min-w-0 flex-col gap-1">
      {delegations.map((delegation) => {
        const card = delegationCardOf({
          delegation,
          childAgent: agents.find((agent) => agent.id === delegation.childAgentId) ?? null,
        });
        const title = cardTitleOf({ card });
        const revision = revisionWordOf({ card });
        const asks = artifactLinksOf({ view, card }).filter(
          (link) => link.approval !== null && link.approval.state !== 'approved',
        );
        return (
          <li key={delegation.id} data-delegation={delegation.id} className="flex flex-col gap-2">
            <span className="flex h-7 min-w-0 items-center gap-2 text-label">
              <span className="flex size-5 shrink-0 items-center justify-center">
                <WorkNode
                  size="sm"
                  state={delegationNodeOf({ card })}
                  mark={{ kind: 'dot' }}
                  label={card.status.word}
                />
              </span>
              <span className="shrink-0 text-muted-foreground">Delegated to</span>
              <AgentKindChip kind={card.role} />
              {revision === null ? null : (
                <span className="min-w-0 truncate text-muted-foreground">{revision}</span>
              )}
              <Button
                variant="quiet"
                size="xs"
                aria-label={`See more about ${title}`}
                onClick={() => onOpenChild(card.childAgentId)}
              >
                See more
              </Button>
            </span>
            {delegation.state === 'awaiting_confirm' ? (
              <DelegationConfirmRow
                line={confirmLineOf({ view, delegation, card })}
                isBusy={decision.busyId === delegation.id}
                onConfirm={() =>
                  void decision.decide({ delegationId: delegation.id, decision: 'confirm' })
                }
                onCancel={() =>
                  void decision.decide({ delegationId: delegation.id, decision: 'decline' })
                }
              />
            ) : null}
            {asks.map((link) => (
              <AutoPlanAsk
                key={link.artifactId}
                sessionId={sessionId}
                link={link}
                onOpen={onOpenArtifact}
              />
            ))}
          </li>
        );
      })}
    </ul>
  );
};
