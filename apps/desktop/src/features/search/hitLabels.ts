import type { SearchHit } from '@goodboy/types';

type Params = {
  readonly hit: SearchHit;
};

export const hitHeadline = ({ hit }: Params): SearchHit['title'] => {
  if (hit.kind !== 'message') {
    return hit.title;
  }
  const agent = hit.agentName ?? 'Agent';
  const text = hit.status === 'user' ? `You, to ${agent}` : agent;
  return [{ text, isMatch: false }];
};

export const hitCrumb = ({ hit }: Params): string =>
  [hit.sessionTitle, hit.kind === 'message' ? null : hit.agentName, hit.container]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(' · ');
