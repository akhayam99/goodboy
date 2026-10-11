import type { SessionId } from '@goodboy/types';
import { selectCheckChain } from './selectCheckChain';

type Params = {
  readonly state: Parameters<typeof selectCheckChain>[0]['state'];
  readonly sessionId: SessionId;
};

export const fixOfferKey = ({
  agentId,
  url,
}: {
  readonly agentId: string;
  readonly url: string;
}): string => `${agentId}|${url}`;

export const selectFixOffers = ({ state, sessionId }: Params): string =>
  (state.sessionPhaseRuns[sessionId] ?? [])
    .flatMap((agent) => {
      if (agent.sourceKind !== 'failed_check' || agent.sourceCommentUrl === undefined) {
        return [];
      }
      const chain = selectCheckChain({ state, sessionId, url: agent.sourceCommentUrl });
      return chain.state === 'proposal' && chain.debugger?.id === agent.id
        ? [fixOfferKey({ agentId: agent.id, url: agent.sourceCommentUrl })]
        : [];
    })
    .join('\n');
