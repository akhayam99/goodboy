import { useMemo, useState } from 'react';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, type LensKind } from '../../../../store';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { useSessionSuggestions } from '../../useSessionSuggestions';
import { useSuggestionActions, type SuggestionActions } from '../../useSuggestionActions';
import { useTranscriptMountProposals } from '../../useTranscriptMountProposals';
import { transcriptOwnedProjectIds } from '../../transcriptMountProposals';
import { recordNextStepOutcome } from '../../useNextStepOutcomes';
import type { SessionSuggestion } from '../../types';
import { NextStepRow } from './NextStepRow';

const choiceKey = ({
  suggestion,
  choiceId,
}: {
  readonly suggestion: SessionSuggestion;
  readonly choiceId: string;
}) => `${suggestion.id}:choice:${choiceId}`;

const pendingChoiceIds = ({
  suggestion,
  pendingKeys,
}: {
  readonly suggestion: SessionSuggestion;
  readonly pendingKeys: ReadonlySet<string>;
}): ReadonlySet<string> => {
  const prefix = choiceKey({ suggestion, choiceId: '' });
  return new Set(
    [...pendingKeys].flatMap((key) => (key.startsWith(prefix) ? [key.slice(prefix.length)] : [])),
  );
};

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const NextStepSlot = ({ session, onSelectLens }: Props) => {
  const sessionId = session.id;
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const suggestions = useSessionSuggestions({ session, agents });
  const transcriptProposals = useTranscriptMountProposals({ session });
  const transcriptOwned = useMemo(
    () => transcriptOwnedProjectIds({ proposals: transcriptProposals }),
    [transcriptProposals],
  );
  const actionsFor = useSuggestionActions({
    session,
    agents,
    onSelectQuestions: () => onSelectLens('questions'),
  });
  const pending = usePendingAction({ sessionId });
  const [expanded, setExpanded] = useState(false);
  const [notNowIds, setNotNowIds] = useState<ReadonlySet<string>>(new Set());

  const visible = suggestions.filter(
    (suggestion) =>
      !notNowIds.has(suggestion.id) &&
      (suggestion.kind !== 'mount-project' || !transcriptOwned.has(suggestion.payload.projectId)),
  );
  const [first, ...rest] = visible;
  if (first === undefined) {
    return null;
  }

  const onNotNow = (suggestion: SessionSuggestion, actions: SuggestionActions) => {
    setNotNowIds((current) => new Set([...current, suggestion.id]));
    void recordNextStepOutcome({
      sessionId,
      kind: suggestion.kind,
      outcome: 'dismissed',
      fingerprint: suggestion.fingerprint,
    });
    const dismiss = actions.onDismiss;
    if (dismiss === null) {
      return;
    }
    void pending.run({
      key: `${suggestion.id}:dismiss`,
      failureTitle: "Couldn't dismiss the suggestion",
      task: dismiss,
    });
  };

  const trackedActions = (suggestion: SessionSuggestion): SuggestionActions => {
    const actions = actionsFor({ suggestion });
    const primary = actions.primary;
    if (primary === null) {
      return actions;
    }
    const tracked =
      ({ key, task }: { readonly key: string; readonly task: () => Promise<void> }) =>
      async () => {
        void recordNextStepOutcome({
          sessionId,
          kind: suggestion.kind,
          outcome: 'accepted',
          fingerprint: suggestion.fingerprint,
        });
        await pending.run({ key, failureTitle: primary.failureTitle, task });
      };
    return {
      ...actions,
      primary: {
        ...primary,
        run: tracked({ key: suggestion.id, task: primary.run }),
        ...(primary.choices !== undefined && {
          choices: primary.choices.map((choice) => ({
            ...choice,
            run: tracked({ key: choiceKey({ suggestion, choiceId: choice.id }), task: choice.run }),
          })),
        }),
      },
    };
  };

  const rowFor = ({
    suggestion,
    isCompact,
  }: {
    readonly suggestion: SessionSuggestion;
    readonly isCompact: boolean;
  }) => {
    const actions = trackedActions(suggestion);
    return (
      <NextStepRow
        key={suggestion.id}
        suggestion={suggestion}
        actions={actions}
        compact={isCompact}
        isPending={pending.pendingKeys.has(suggestion.id)}
        pendingChoiceIds={pendingChoiceIds({ suggestion, pendingKeys: pending.pendingKeys })}
        onNotNow={() => onNotNow(suggestion, actions)}
      />
    );
  };

  return (
    <div className="flex flex-col gap-1">
      {rowFor({ suggestion: first, isCompact: false })}
      {rest.length > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start px-2 text-label text-faint-foreground transition-colors hover:text-foreground"
        >
          {rest.length} more
        </button>
      )}
      {expanded && rest.map((suggestion) => rowFor({ suggestion, isCompact: true }))}
    </div>
  );
};
