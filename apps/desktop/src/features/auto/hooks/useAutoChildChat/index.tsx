import { useMemo } from 'react';
import type { AutoDelegation } from '@goodboy/db';
import type { Agent, Session } from '@goodboy/types';
import { useTranscript } from '../../../../store';
import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';
import type { AutoTreeOfAgent } from '../../autoTreeOfAgent';
import { delegationCardOf } from '../../chat/delegationCardOf';
import { executedRoutingOf } from '../../executedRoutingOf';
import { isAutoDelegationReplaced } from '../../isAutoDelegationReplaced';
import { useExecutedRoutingOf } from '../../useExecutedRoutingOf';
import { AutoChildBrief } from '../../child/AutoChildBrief';
import { AutoChildEnd } from '../../child/AutoChildEnd';
import { briefImagesOf } from '../../child/briefImagesOf';

type Params = {
  readonly session: Session;
  readonly agent: Agent;
  readonly tree: AutoTreeOfAgent | null;
};

export type AutoChildChat = Readonly<{
  insertions: ReadonlyArray<TranscriptInsertion> | undefined;
  composerPlaceholder: string | undefined;
  task: string | null;
}>;

const NO_DELEGATIONS: ReadonlyArray<AutoDelegation> = [];

const NOT_A_CHILD: AutoChildChat = {
  insertions: undefined,
  composerPlaceholder: undefined,
  task: null,
};

export const useAutoChildChat = ({ session, agent, tree }: Params): AutoChildChat => {
  const events = useTranscript(agent.id);
  const images = useMemo(() => briefImagesOf({ events }), [events]);
  const executed = useExecutedRoutingOf({ agent });
  const delegation = tree?.kind === 'child' ? tree.delegation : null;
  const delegations = tree?.view.delegations ?? NO_DELEGATIONS;

  return useMemo(() => {
    if (delegation === null) {
      return NOT_A_CHILD;
    }
    const isReplaced = isAutoDelegationReplaced({ delegation, delegations });
    const card = delegationCardOf({ delegation, childAgent: agent, isReplaced });
    return {
      insertions: [
        {
          key: `auto-child-brief-${agent.id}`,
          beforeMs: 0,
          node: (
            <AutoChildBrief
              card={card}
              images={images}
              routing={executedRoutingOf({
                executed,
                fallback: { provider: card.provider, model: card.model, effort: card.effort },
              })}
            />
          ),
        },
        {
          key: `auto-child-end-${agent.id}`,
          beforeMs: delegation.state === 'settled' ? delegation.settledAt : null,
          node: (
            <AutoChildEnd
              sessionId={session.id}
              delegation={delegation}
              card={card}
              agent={agent}
              isReplaced={isReplaced}
            />
          ),
        },
      ],
      composerPlaceholder: `Message ${card.roleLabel}`,
      task: card.task,
    };
  }, [agent, delegation, delegations, executed, images, session.id]);
};
