import { useMemo } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
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
  const sessionId = session.id as SessionId;
  const isBranchless = useAppStore((state) =>
    isBranchlessSession({ branch: state.sessionBranches[sessionId] }),
  );
  const facts = usePageCountFacts({ session });
  const pages = useMemo(() => pagesOf({ isBranchless, hasOpenQuestions: true }), [isBranchless]);
  return { pages, facts };
};
