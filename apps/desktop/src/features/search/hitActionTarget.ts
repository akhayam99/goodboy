import type { SearchHit } from '@goodboy/types';
import type { ObjectTarget } from '../actions/types';

type Params = {
  readonly hit: SearchHit;
};

export const hitActionTarget = ({ hit }: Params): ObjectTarget | null => {
  if (hit.isArchived || hit.sessionId === null) {
    return hit.url === null ? null : { kind: 'link', href: hit.url };
  }
  if (hit.kind === 'session') {
    return { kind: 'session', sessionId: hit.sessionId };
  }
  if ((hit.kind === 'agent' || hit.kind === 'message') && hit.agentId !== null) {
    return { kind: 'agent', sessionId: hit.sessionId, agentId: hit.agentId };
  }
  return hit.url === null ? null : { kind: 'link', href: hit.url };
};
