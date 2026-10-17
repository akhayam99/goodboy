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

type CrumbParams = Params & {
  readonly isSessionScoped?: boolean;
};

const headlineText = ({ hit }: Params): string =>
  hitHeadline({ hit })
    .map((segment) => segment.text)
    .join('');

export const hitCrumb = ({ hit, isSessionScoped = false }: CrumbParams): string => {
  const headline = headlineText({ hit });
  return [
    isSessionScoped ? null : hit.sessionTitle,
    hit.kind === 'message' ? null : hit.agentName,
    hit.container !== null && headline.includes(hit.container) ? null : hit.container,
  ]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(' · ');
};
