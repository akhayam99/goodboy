import type { AutoDelegation } from '@goodboy/db';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { autoChildLabelsOf } from '../autoChildLabelsOf';
import { AutoChildCard } from './AutoChildCard';
import { cardTitleOf } from './cardTitleOf';
import { delegationCardOf } from './delegationCardOf';
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
};

export const AutoDelegationLines = ({
  sessionId,
  view,
  delegations,
  agents,
  onOpenChild,
}: Props) => {
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
        return (
          <li key={delegation.id} data-delegation={delegation.id} className="flex flex-col gap-2">
            <AutoChildCard
              sessionId={sessionId}
              delegation={delegation}
              card={card}
              name={name}
              revision={revision}
              onOpen={onOpenChild}
            />
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
