import { useState } from 'react';
import type { AutoDelegation } from '@goodboy/db';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { Button, TruncatedText } from '@goodboy/ui';
import { AgentKindChip } from '../../../shared/components/AgentKindChip';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { autoChildLabelsOf } from '../autoChildLabelsOf';
import { artifactLinksOf } from './artifactLinksOf';
import { AutoChildCard } from './AutoChildCard';
import { AutoNextAction } from './AutoNextAction';
import { AutoPlanAsk } from './AutoPlanAsk';
import { cardTitleOf } from './cardTitleOf';
import { delegationCardOf } from './delegationCardOf';
import { nextActionOf } from './nextActionOf';
import { revisionWordOf } from './revisionWordOf';
import { PublishConfirmRow } from './PublishConfirmRow';
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
  const [untold, setUntold] = useState<Readonly<Record<string, string>>>({});
  const publishing = usePublishAct();
  const labels = autoChildLabelsOf({ delegations: view.delegations });
  const waiting = waitingPublishesOf({ delegations });
  return (
    <ul aria-label="Delegations" className="flex min-w-0 flex-col gap-1">
      {delegations.map((delegation) => {
        const childAgent = agents.find((agent) => agent.id === delegation.childAgentId) ?? null;
        const card = delegationCardOf({ delegation, childAgent });
        const title = cardTitleOf({ card });
        const name = labels.get(card.childAgentId) ?? card.task ?? title;
        const revision = revisionWordOf({ card });
        const asks = artifactLinksOf({ view, artifacts: card.result?.artifacts ?? [] }).filter(
          (link) => link.approval !== null,
        );
        return (
          <li key={delegation.id} data-delegation={delegation.id} className="flex flex-col gap-2">
            {delegation.state === 'settled' ? (
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
            ) : (
              <AutoChildCard
                sessionId={sessionId}
                delegation={delegation}
                card={card}
                agent={childAgent}
                name={name}
                revision={revision}
                onOpen={onOpenChild}
              />
            )}
            {delegation.state === 'awaiting_confirm' || untold[delegation.id] !== undefined ? (
              <AutoNextAction
                sessionId={sessionId}
                rootAgentId={view.tree.rootAgentId}
                action={nextActionOf({ view, delegation, card })}
                untold={untold[delegation.id] ?? null}
                onUntold={(content) =>
                  setUntold((current) => {
                    const rest = Object.fromEntries(
                      Object.entries(current).filter(([id]) => id !== delegation.id),
                    );
                    return content === null ? rest : { ...rest, [delegation.id]: content };
                  })
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
