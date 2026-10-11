import type { IssueBriefSource } from '../../../store/slices/issue-briefs/types';

type Params = {
  readonly source: Pick<IssueBriefSource, 'identifier' | 'url' | 'noun'>;
};

export const issueReferenceLine = ({ source }: Params): string => {
  const noun = `${source.noun.charAt(0).toUpperCase()}${source.noun.slice(1)}`;
  return source.url !== ''
    ? `${noun}: ${source.identifier} ${source.url}`
    : `${noun}: ${source.identifier}`;
};
