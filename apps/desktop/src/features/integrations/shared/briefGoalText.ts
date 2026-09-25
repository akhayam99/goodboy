import type { IssueBrief } from '@goodboy/core';
import type { IssueBriefSource } from '../../../store/slices/issue-briefs/types';

type Params = {
  readonly brief: IssueBrief;
  readonly source: Pick<IssueBriefSource, 'identifier' | 'url' | 'noun'>;
};

const referenceLine = ({ source }: Pick<Params, 'source'>): string => {
  const noun = `${source.noun.charAt(0).toUpperCase()}${source.noun.slice(1)}`;
  return source.url !== ''
    ? `${noun}: ${source.identifier} ${source.url}`
    : `${noun}: ${source.identifier}`;
};

export const briefGoalText = ({ brief, source }: Params): string => {
  const parts = [brief.goal.trim()];
  if (brief.acceptance.length > 0) {
    parts.push(['Done when:', ...brief.acceptance.map((entry) => `- ${entry}`)].join('\n'));
  }
  parts.push(referenceLine({ source }));
  return parts.join('\n\n');
};
