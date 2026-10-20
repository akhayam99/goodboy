import { useMemo } from 'react';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { useSessionSuggestionsFrom } from '../../../../suggestions/useSessionSuggestions';
import { useTranscriptMountProposals } from '../../../../suggestions/useTranscriptMountProposals';
import { transcriptOwnedProjectIds } from '../../../../suggestions/transcriptMountProposals';
import type { SessionWorkModel } from '../../useSessionWorkModel';
import { actionCardsOf, type ActionCardModel, type AutoActionTarget } from '../actionCardsOf';
import { useActionCardActions, type ActionCardActions } from '../useActionCardActions';

type Params = {
  readonly session: Session;
  readonly model: SessionWorkModel;
  readonly autoTargets: ReadonlyArray<AutoActionTarget>;
};

type Result = {
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly actionsFor: ActionCardActions['actionsFor'];
};

export const useNextCards = ({ session, model, autoTargets }: Params): Result => {
  const sessionId = session.id;
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const ownedQuestionIds = useMemo(
    () => new Set(model.owners.flatMap((owner) => owner.questionIds)),
    [model.owners],
  );
  const suggestions = useSessionSuggestionsFrom({
    session,
    agents,
    shownQuestionIds: ownedQuestionIds,
    attachedRuns: model.workflows,
    advanceByRunId: model.advanceByRunId,
    isActivityShown: false,
  });
  const transcriptProposals = useTranscriptMountProposals({ session });
  const transcriptOwned = useMemo(
    () => transcriptOwnedProjectIds({ proposals: transcriptProposals }),
    [transcriptProposals],
  );
  const { actionsFor, isHidden } = useActionCardActions({ session });

  const cards = useMemo(
    () =>
      actionCardsOf({
        owners: model.owners,
        suggestions: suggestions.filter(
          (suggestion) =>
            suggestion.kind !== 'mount-project' ||
            !transcriptOwned.has(suggestion.payload.projectId),
        ),
        autoTargets,
      }).filter((card) => !isHidden({ card })),
    [autoTargets, isHidden, model.owners, suggestions, transcriptOwned],
  );

  return { cards, actionsFor };
};
