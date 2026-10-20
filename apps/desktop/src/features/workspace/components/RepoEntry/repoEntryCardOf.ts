import type { FactCardSpec } from '@goodboy/ui';
import { fitCardRows } from '../../../../shared/utils/fitCardRows';
import type { RepoEntryFacts } from './repoEntryFactsOf';

type Params = {
  readonly facts: RepoEntryFacts;
  readonly repoCount: number;
};

export const repoEntryCardOf = ({ facts, repoCount }: Params): FactCardSpec => {
  const fitted = fitCardRows({ facts: facts.rows });
  const title = 'Repositories';
  if (facts.rows.length === 0) {
    return { title, state: { tone: 'neutral', words: facts.summary }, facts: [] };
  }
  return {
    title,
    sub: repoCount === 1 ? '1 repo' : `${repoCount} repos`,
    facts: fitted.facts,
    ...(fitted.footnote === undefined ? {} : { footnote: fitted.footnote }),
  };
};
