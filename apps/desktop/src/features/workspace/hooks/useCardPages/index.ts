import { useMemo } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
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
  const hasOneBranch = useAppStore(
    (state) => (state.sessionProjectMounts[session.id] ?? []).length === 1,
  );
  const pages = useMemo(() => pagesOf({ hasOpenQuestions: true, hasOneBranch }), [hasOneBranch]);
  return { pages, facts };
};
