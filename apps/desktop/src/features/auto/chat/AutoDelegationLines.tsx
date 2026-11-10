import type { AutoDelegation } from '@goodboy/db';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { autoChildLabelsOf } from '../autoChildLabelsOf';
import { isAutoDelegationReplaced } from '../isAutoDelegationReplaced';
import { AutoChildCard } from './AutoChildCard';
import { cardTitleOf } from './cardTitleOf';
import { delegationCardOf } from './delegationCardOf';
import { revisionWordOf } from './revisionWordOf';
import { publishRowsOf } from './publishRowsOf';
import { PublishRunRow } from './PublishRunRow';
import { usePublishAct } from './usePublishAct';

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
  const publishRows = publishRowsOf({ delegations });
  return (
    <ul aria-label="Delegations" className="flex min-w-0 flex-col gap-1">
      {delegations.map((delegation) => {
        const childAgent = agents.find((agent) => agent.id === delegation.childAgentId) ?? null;
        const card = delegationCardOf({
          delegation,
          childAgent,
          isReplaced: isAutoDelegationReplaced({ delegation, delegations: view.delegations }),
        });
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
      {publishRows.length === 0 ? null : (
        <li data-publish-run="">
          <PublishRunRow
            rows={publishRows}
            busyIds={publishing.busyIds}
            onAct={({ act, delegationIds }) =>
              void publishing.act({ act, delegationIds, sessionId })
            }
          />
        </li>
      )}
    </ul>
  );
};
