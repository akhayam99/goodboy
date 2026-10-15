import type { AutoDelegation } from '@goodboy/db';
import type { Agent } from '@goodboy/types';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { artifactLinksOf } from './artifactLinksOf';
import { confirmLineOf } from './confirmLineOf';
import { DelegationCard } from './DelegationCard';
import { delegationCardOf, type DelegationCardModel } from './delegationCardOf';
import { useDelegationDecision } from './useDelegationDecision';

type Props = {
  readonly view: AutoTreeView;
  readonly delegations: ReadonlyArray<AutoDelegation>;
  readonly agents: ReadonlyArray<Agent>;
  readonly onOpenAgent: (card: DelegationCardModel) => void;
  readonly onOpenArtifact: (artifactId: string) => void;
};

export const DelegationBatch = ({
  view,
  delegations,
  agents,
  onOpenAgent,
  onOpenArtifact,
}: Props) => {
  const decision = useDelegationDecision();
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {delegations.map((delegation) => {
        const card = delegationCardOf({
          delegation,
          childAgent: agents.find((agent) => agent.id === delegation.childAgentId) ?? null,
        });
        return (
          <DelegationCard
            key={delegation.id}
            card={card}
            links={artifactLinksOf({ view, card })}
            onOpenChat={onOpenAgent}
            onOpenArtifact={onOpenArtifact}
            {...(delegation.state === 'awaiting_confirm' && {
              confirm: {
                line: confirmLineOf({ view, delegation, card }),
                isBusy: decision.busyId === delegation.id,
                onConfirm: () =>
                  void decision.decide({ delegationId: delegation.id, decision: 'confirm' }),
                onCancel: () =>
                  void decision.decide({ delegationId: delegation.id, decision: 'decline' }),
              },
            })}
          />
        );
      })}
    </div>
  );
};
