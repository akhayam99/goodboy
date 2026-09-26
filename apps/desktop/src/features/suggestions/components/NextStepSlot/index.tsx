import { useState } from 'react';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, type LensKind } from '../../../../store';
import { useSessionSuggestions } from '../../useSessionSuggestions';
import { useSuggestionActions, type SuggestionActions } from '../../useSuggestionActions';
import { recordNextStepOutcome } from '../../useNextStepOutcomes';
import type { SessionSuggestion } from '../../types';
import { NextStepRow } from './NextStepRow';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const NextStepSlot = ({ session, onSelectLens }: Props) => {
  const sessionId = session.id;
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const suggestions = useSessionSuggestions({ session, agents });
  const actionsFor = useSuggestionActions({
    session,
    agents,
    onSelectQuestions: () => onSelectLens('questions'),
  });
  const [expanded, setExpanded] = useState(false);
  const [notNowIds, setNotNowIds] = useState<ReadonlySet<string>>(new Set());

  const visible = suggestions.filter((suggestion) => !notNowIds.has(suggestion.id));
  const [first, ...rest] = visible;
  if (first === undefined) {
    return null;
  }

  const onNotNow = (suggestion: SessionSuggestion) => {
    setNotNowIds((current) => new Set([...current, suggestion.id]));
    void recordNextStepOutcome({
      sessionId,
      kind: suggestion.kind,
      outcome: 'dismissed',
      fingerprint: suggestion.fingerprint,
    });
  };

  const trackedActions = (suggestion: SessionSuggestion): SuggestionActions => {
    const actions = actionsFor({ suggestion });
    if (actions.primary === null) {
      return actions;
    }
    return {
      ...actions,
      primary: {
        ...actions.primary,
        onAct: () => {
          void recordNextStepOutcome({
            sessionId,
            kind: suggestion.kind,
            outcome: 'accepted',
            fingerprint: suggestion.fingerprint,
          });
          actions.primary?.onAct();
        },
      },
    };
  };

  return (
    <div className="flex flex-col gap-1">
      <NextStepRow
        suggestion={first}
        actions={trackedActions(first)}
        compact={false}
        onNotNow={() => onNotNow(first)}
      />
      {rest.length > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start px-2 text-label text-faint-foreground transition-colors hover:text-foreground"
        >
          {rest.length} more
        </button>
      )}
      {expanded &&
        rest.map((suggestion) => (
          <NextStepRow
            key={suggestion.id}
            suggestion={suggestion}
            actions={trackedActions(suggestion)}
            compact
            onNotNow={() => onNotNow(suggestion)}
          />
        ))}
    </div>
  );
};
