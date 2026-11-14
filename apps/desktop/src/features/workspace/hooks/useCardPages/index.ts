import { useMemo } from 'react';
import type { Session } from '@goodboy/types';
import { usePageCountFacts } from '../../../session/hooks/usePageCountFacts';
import type { PageCountFacts } from '../../../session/pageCountWord';
import { pagesOf, type Page } from '../../../session/pageRegistry';

type Params = {
  readonly session: Session;
};

export type CardPages = {
  readonly pages: ReadonlyArray<Page>;
  readonly facts: PageCountFacts;
};

export const useCardPages = ({ session }: Params): CardPages => {
  const facts = usePageCountFacts({ session });
  const pages = useMemo(() => pagesOf({ hasOpenQuestions: true }), []);
  return { pages, facts };
};
