import { useMemo } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { agentPlace, sessionPlace, useAppStore, type LensKind } from '../../../../../store';
import { openInEditor } from '../../../../../shared/lib/editor';
import { markStepComplete } from '../../../../onboarding/onboarding-store';
import { openReview } from '../../../../review/openReview';

export type BoardNavigation = {
  readonly selectCard: (session: Session) => void;
  readonly openAgent: (session: Session) => void;
  readonly openTerminal: (session: Session) => void;
  readonly openIDE: (session: Session) => void;
  readonly openQuestions: (session: Session) => void;
  readonly openWorkflows: (session: Session) => void;
  readonly openGithub: (session: Session) => void;
};

type OpenLensParams = {
  readonly session: Session;
  readonly lens: LensKind | null;
};

export const useBoardNavigation = (): BoardNavigation => {
  const navigate = useAppStore((s) => s.navigate);

  return useMemo<BoardNavigation>(() => {
    const openLens = ({ session, lens }: OpenLensParams): void => {
      navigate({ to: sessionPlace({ sessionId: session.id as SessionId, lens }) });
    };

    const selectCard = (session: Session): void => {
      openLens({ session, lens: null });
      markStepComplete('session');
    };

    const openAgent = (session: Session): void => {
      const id = session.id as SessionId;
      const agent = (useAppStore.getState().sessionPhaseRuns[id] ?? [])[0];
      navigate({
        to:
          agent === undefined
            ? sessionPlace({ sessionId: id })
            : agentPlace({ sessionId: id, agentId: agent.id }),
      });
      window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
    };

    const openIDE = (session: Session): void => {
      const path = useAppStore.getState().sessionWorktrees[session.id]?.[0];
      if (path) {
        void openInEditor(path);
      }
    };

    const openGithub = (session: Session): void => {
      openLens({ session, lens: null });
      void openReview({ sessionId: session.id as SessionId });
    };

    return {
      selectCard,
      openAgent,
      openTerminal: (session) => openLens({ session, lens: 'terminal' }),
      openIDE,
      openQuestions: (session) => openLens({ session, lens: 'questions' }),
      openWorkflows: (session) => openLens({ session, lens: 'workflows' }),
      openGithub,
    };
  }, [navigate]);
};
