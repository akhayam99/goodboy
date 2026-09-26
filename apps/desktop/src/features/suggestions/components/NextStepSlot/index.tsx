import { useState } from 'react';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useSessionSuggestions } from '../../useSessionSuggestions';
import { useSuggestionActions } from '../../useSuggestionActions';
import { NextStepRow } from './NextStepRow';

type Props = {
  readonly session: Session;
};

export const NextStepSlot = ({ session }: Props) => {
  const sessionId = session.id;
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const suggestions = useSessionSuggestions({ session, agents });
  const actionsFor = useSuggestionActions({
    session,
    agents,
    onSelectQuestions: () => setActiveLens(sessionId, 'questions'),
  });
  const [expanded, setExpanded] = useState(false);
  const [notNowIds, setNotNowIds] = useState<ReadonlySet<string>>(new Set());

  const visible = suggestions.filter((suggestion) => !notNowIds.has(suggestion.id));
  const [first, ...rest] = visible;
  if (first === undefined) {
    return null;
  }

  const onNotNow = (id: string) => {
    setNotNowIds((current) => new Set([...current, id]));
  };

  return (
    <div className="flex flex-col gap-1">
      <NextStepRow
        suggestion={first}
        actions={actionsFor({ suggestion: first })}
        compact={false}
        onNotNow={() => onNotNow(first.id)}
      />
      {rest.length > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start px-2 text-xs text-faint-foreground transition-colors hover:text-foreground"
        >
          {rest.length} more
        </button>
      )}
      {expanded &&
        rest.map((suggestion) => (
          <NextStepRow
            key={suggestion.id}
            suggestion={suggestion}
            actions={actionsFor({ suggestion })}
            compact
            onNotNow={() => onNotNow(suggestion.id)}
          />
        ))}
    </div>
  );
};
