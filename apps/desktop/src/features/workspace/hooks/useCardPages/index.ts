import { useMemo } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { usePageCountFacts } from '../../../session/hooks/usePageCountFacts';
import type { PageCountFacts } from '../../../session/pageCountWord';
import { columnPagesOf, pagesOf, type Page } from '../../../session/pageRegistry';

type Params = {
  readonly session: Session;
};

export type CardPages = {
  readonly pages: ReadonlyArray<Page>;
  readonly facts: PageCountFacts;
};

const QUESTION_DESTINATION = [{ lens: 'questions', shortcut: 'lens.questions' }] as const;

export const useCardPages = ({ session }: Params): CardPages => {
  const sessionId = session.id as SessionId;
  const isBranchless = useAppStore((state) =>
    isBranchlessSession({ branch: state.sessionBranches[sessionId] }),
  );
  const facts = usePageCountFacts({ session });
  const pages = useMemo(
    () => [
      ...columnPagesOf({ isBranchless }),
      ...pagesOf({
        isBranchless,
        destinations: QUESTION_DESTINATION,
        hasOpenQuestions: true,
      }).filter((page) => page.id === 'questions'),
    ],
    [isBranchless],
  );
  return { pages, facts };
};
