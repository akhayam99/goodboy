import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionHeader } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, type LensKind } from '../../../../store';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { useShowToast } from '../../../../shared/components/Toast/useShowToast';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { useSessionSuggestions } from '../../useSessionSuggestions';
import { useSuggestionActions, type SuggestionActions } from '../../useSuggestionActions';
import { useTranscriptMountProposals } from '../../useTranscriptMountProposals';
import { transcriptOwnedProjectIds } from '../../transcriptMountProposals';
import { recordNextStepOutcome, revertNextStepOutcome } from '../../useNextStepOutcomes';
import type { SessionSuggestion } from '../../types';
import type { AgentKindRouting } from '../../../session/agent-kind';
import type { ActionTrack } from '../../../actions/types';
import { NextStepRow } from './NextStepRow';
import { NEXT_STEP_LIST } from './nextStepGrid';

const CHOICE_FAILURE_TITLE = "Couldn't start that";

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

type LeadChange = {
  readonly hasLead: boolean;
};

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
  readonly shownQuestionIds?: ReadonlySet<string>;
  readonly shownAgentIds?: ReadonlySet<string>;
  readonly onLeadChange?: (change: LeadChange) => void;
};

const NO_AGENTS: ReadonlySet<string> = new Set();

const SHOWN_ROWS = 3;

type RowParams = {
  readonly suggestion: SessionSuggestion;
  readonly isLead: boolean;
  readonly isCompact: boolean;
};

const isShownElsewhere = ({
  suggestion,
  shownAgentIds,
}: {
  readonly suggestion: SessionSuggestion;
  readonly shownAgentIds: ReadonlySet<string>;
}): boolean => suggestion.kind === 'approve-tool' && shownAgentIds.has(suggestion.payload.agentId);

export const NextStepSlot = ({
  session,
  onSelectLens,
  shownQuestionIds,
  shownAgentIds = NO_AGENTS,
  onLeadChange,
}: Props) => {
  const sessionId = session.id;
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const suggestions = useSessionSuggestions({ session, agents, shownQuestionIds });
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
  const showToast = useShowToast();
  const undoable = useAppStore((state) => state.undoable);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const visible = suggestions.filter(
    (suggestion) =>
      !notNowIds.has(suggestion.id) &&
      !isShownElsewhere({ suggestion, shownAgentIds }) &&
      (suggestion.kind !== 'mount-project' || !transcriptOwned.has(suggestion.payload.projectId)),
  );
  const hasLead = visible.length > 0;

  useEffect(() => {
    onLeadChange?.({ hasLead });
  }, [hasLead, onLeadChange]);

  const shown = visible.slice(0, SHOWN_ROWS);
  const rest = visible.slice(SHOWN_ROWS);
  if (shown.length === 0) {
    return null;
  }

  const onNotNow = (suggestion: SessionSuggestion, actions: SuggestionActions) => {
    setNotNowIds((current) => new Set([...current, suggestion.id]));
    const recorded = recordNextStepOutcome({
      sessionId,
      kind: suggestion.kind,
      outcome: 'dismissed',
      fingerprint: suggestion.fingerprint,
    });
    const dismiss = actions.onDismiss;
    if (dismiss !== null) {
      void pending.run({
        key: `${suggestion.id}:dismiss`,
        failureTitle: "Couldn't dismiss the suggestion",
        task: dismiss,
      });
      return;
    }
    undoable({
      message: 'Dismissed',
      actionHint: shortcutGlyphs('app.undo'),
      conflictMessage: 'The suggestion is already back.',
      isCurrent: () => isMountedRef.current,
      showToast,
      undo: async () => {
        const eventId = await recorded;
        if (eventId !== null) {
          await revertNextStepOutcome({ sessionId, id: eventId });
        }
        setNotNowIds((current) => new Set([...current].filter((id) => id !== suggestion.id)));
      },
    });
  };

  const trackedActions = (suggestion: SessionSuggestion): SuggestionActions => {
    const actions = actionsFor({ suggestion });
    const primary = actions.primary;
    if (primary === null) {
      return actions;
    }
    const runsOn = primary.runsOn;
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
        ...(runsOn !== undefined && {
          runsOn: {
            kind: runsOn.kind,
            runWith: (routing: AgentKindRouting) =>
              tracked({ key: suggestion.id, task: () => runsOn.runWith(routing) })(),
          },
        }),
      },
    };
  };

  const trackChoiceFor =
    ({
      suggestion,
      actions,
    }: {
      readonly suggestion: SessionSuggestion;
      readonly actions: SuggestionActions;
    }): ActionTrack =>
    async ({ actionId, task }) => {
      void recordNextStepOutcome({
        sessionId,
        kind: suggestion.kind,
        outcome: 'accepted',
        fingerprint: suggestion.fingerprint,
      });
      await pending.run({
        key: choiceKey({ suggestion, choiceId: actionId }),
        failureTitle: actions.primary?.failureTitle ?? CHOICE_FAILURE_TITLE,
        task,
      });
    };

  const rowFor = ({ suggestion, isLead, isCompact }: RowParams) => {
    const actions = trackedActions(suggestion);
    return (
      <NextStepRow
        key={suggestion.id}
        suggestion={suggestion}
        actions={actions}
        compact={isCompact}
        isLead={isLead}
        isPending={pending.pendingKeys.has(suggestion.id)}
        pendingChoiceIds={pendingChoiceIds({ suggestion, pendingKeys: pending.pendingKeys })}
        trackChoice={trackChoiceFor({ suggestion, actions })}
        onNotNow={() => onNotNow(suggestion, actions)}
      />
    );
  };

  return (
    <section aria-label="Next" className="flex flex-col gap-2">
      <SectionHeader label="Next" headingLevel={2} />
      <div className={NEXT_STEP_LIST}>
        {shown.map((suggestion, index) =>
          rowFor({ suggestion, isLead: index === 0, isCompact: false }),
        )}
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
          rest.map((suggestion) => rowFor({ suggestion, isLead: false, isCompact: true }))}
      </div>
    </section>
  );
};
