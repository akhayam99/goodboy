import { useMemo } from 'react';
import { brandId, type Session, type SessionId } from '@goodboy/types';
import { useAppStore, type LensKind } from '../../../../../store';
import { lensPlace } from '../../../../../store/slices/navigation/canonicalLocation';
import { openInConfiguredEditor } from '../../../../../shared/lib/editorSettings';
import { openReview } from '../../../../review/openReview';
import { attentionPlace } from '../../../../session/attentionPlace';
import { openAgentRevealEvent } from '../../../../../shared/utils/openAgentReveal';

export type BoardNavigation = {
  readonly selectCard: (session: Session) => void;
  readonly openUnreadReply: (session: Session) => void;
  readonly openIDE: (session: Session) => void;
  readonly openQuestions: (session: Session) => void;
  readonly openWorkflows: (session: Session) => void;
  readonly openPullRequest: (session: Session) => void;
  readonly openReview: (session: Session) => void;
};

type OpenLensParams = {
  readonly session: Session;
  readonly lens: LensKind | null;
};

type SessionParams = {
  readonly session: Session;
};

const sessionIdOf = ({ session }: SessionParams): SessionId =>
  brandId<SessionId>({ value: session.id });

export const useBoardNavigation = (): BoardNavigation => {
  const navigate = useAppStore((s) => s.navigate);

  return useMemo<BoardNavigation>(() => {
    const openLens = ({ session, lens }: OpenLensParams): void => {
      navigate({
        to: lensPlace({
          state: useAppStore.getState(),
          sessionId: sessionIdOf({ session }),
          lens,
        }),
      });
    };

    const selectCard = (session: Session): void => {
      openLens({ session, lens: null });
    };

    const openUnreadReply = (session: Session): void => {
      navigate({
        to: attentionPlace({
          state: useAppStore.getState(),
          sessionId: sessionIdOf({ session }),
          reason: 'unread-reply',
        }),
      });
      window.dispatchEvent(openAgentRevealEvent());
    };

    const openIDE = (session: Session): void => {
      const state = useAppStore.getState();
      const path = state.sessionWorktrees[session.id]?.[0];
      if (path) {
        void openInConfiguredEditor({ path, state });
      }
    };

    const openReviewOf = (session: Session): void => {
      void openReview({ sessionId: sessionIdOf({ session }) });
    };

    return {
      selectCard,
      openUnreadReply,
      openIDE,
      openQuestions: (session) =>
        navigate({
          to: attentionPlace({
            state: useAppStore.getState(),
            sessionId: sessionIdOf({ session }),
            reason: 'open-question',
          }),
        }),
      openWorkflows: (session) => openLens({ session, lens: 'workflows' }),
      openPullRequest: (session) => openLens({ session, lens: 'pr' }),
      openReview: openReviewOf,
    };
  }, [navigate]);
};
