import type { IssueBrief } from '@goodboy/core';
import type { IssueBriefSource } from '../../../store/slices/issue-briefs/types';
import { issueReferenceLine } from './issueReferenceLine';

type Params = {
  readonly brief: IssueBrief;
  readonly source: Pick<IssueBriefSource, 'identifier' | 'url' | 'noun'>;
  readonly more?: ReadonlyArray<Pick<IssueBriefSource, 'identifier' | 'url' | 'noun'>>;
};

export const briefGoalText = ({ brief, source, more = [] }: Params): string => {
  const parts = [brief.goal.trim()];
  if (brief.acceptance.length > 0) {
    parts.push(['Done when:', ...brief.acceptance.map((entry) => `- ${entry}`)].join('\n'));
  }
  parts.push([source, ...more].map((entry) => issueReferenceLine({ source: entry })).join('\n'));
  return parts.join('\n\n');
};
