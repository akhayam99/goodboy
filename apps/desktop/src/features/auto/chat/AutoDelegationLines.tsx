import type { AutoDelegation } from '@goodboy/db';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { Button, TruncatedText } from '@goodboy/ui';
import { AgentKindChip } from '../../../shared/components/AgentKindChip';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { autoChildLabelsOf } from '../autoChildLabelsOf';
import { artifactLinksOf } from './artifactLinksOf';
import { AutoPlanAsk } from './AutoPlanAsk';
import { cardTitleOf } from './cardTitleOf';
import { confirmLineOf } from './confirmLineOf';
import { delegationCardOf } from './delegationCardOf';
import { DelegationConfirmRow } from './DelegationConfirmRow';
import { revisionWordOf } from './revisionWordOf';
import { PublishConfirmRow } from './PublishConfirmRow';
import { useDelegationDecision } from './useDelegationDecision';
import { usePublishAct } from './usePublishAct';
import { waitingPublishesOf } from './waitingPublishesOf';

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
  const publishing = usePublishAct();
  const labels = autoChildLabelsOf({ delegations: view.delegations });
  const waiting = waitingPublishesOf({ delegations });
  return (
    <ul aria-label="Delegations" className="flex min-w-0 flex-col gap-1">
      {delegations.map((delegation) => {
        const card = delegationCardOf({
          delegation,
          childAgent: agents.find((agent) => agent.id === delegation.childAgentId) ?? null,
        });
        const title = cardTitleOf({ card });
        const name = labels.get(card.childAgentId) ?? card.task ?? title;
        const revision = revisionWordOf({ card });
        const asks = artifactLinksOf({ view, card }).filter(
          (link) => link.approval !== null && link.approval.state !== 'approved',
        );
        return (
          <li key={delegation.id} data-delegation={delegation.id} className="flex flex-col gap-2">
            <span className="flex h-7 min-w-0 items-center gap-2 text-meta">
              <AgentKindChip kind={card.role} density="glyph" />
              <TruncatedText
                className="min-w-0 truncate text-foreground"
                tooltip={card.task ?? title}
              >
                {name}
              </TruncatedText>
              {revision === null ? null : (
                <span className="shrink-0 text-muted-foreground">{revision}</span>
              )}
              <Button
                variant="quiet"
                size="xs"
                aria-label={`Open ${name}`}
                onClick={() => onOpenChild(card.childAgentId)}
              >
                Open
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
      {waiting.length === 0 ? null : (
        <li data-publish-confirm="">
          <PublishConfirmRow
            branches={waiting.map((one) => one.branch)}
            isBusy={waiting.some((one) => publishing.busyIds.includes(one.delegationId))}
            onConfirm={() =>
              void publishing.act({
                act: 'confirm',
                delegationIds: waiting.map((one) => one.delegationId),
                sessionId,
              })
            }
            onDecline={() =>
              void publishing.act({
                act: 'decline',
                delegationIds: waiting.map((one) => one.delegationId),
                sessionId,
              })
            }
          />
        </li>
      )}
    </ul>
  );
};
