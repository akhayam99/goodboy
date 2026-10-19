import { useCallback, useEffect, useRef, useState } from 'react';
import type { Agent, Session } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { usePendingAction, type PendingAction } from '../../../shared/hooks/usePendingAction';
import { useShowToast } from '../../../shared/components/Toast/useShowToast';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { ReportedError } from '../../../store/slices/notifications/reportedError';
import type { ActionTrack } from '../../actions/types';
import type { AgentKindRouting } from '../../session/agent-kind';
import { recordNextStepOutcome, revertNextStepOutcome } from '../useNextStepOutcomes';
import { choiceKey } from '../choiceKey';
import { useSuggestionActions, type SuggestionActions } from '../useSuggestionActions';
import type { SessionSuggestion } from '../types';

const CHOICE_FAILURE_TITLE = "Couldn't start that";

type FailureParams = {
  readonly key: string;
  readonly message: string;
};

type Params = {
  readonly session: Session;
  readonly agents: ReadonlyArray<Agent>;
  readonly onSelectQuestions: () => void;
  readonly onFailure?: (params: FailureParams) => void;
};

type SuggestionParams = {
  readonly suggestion: SessionSuggestion;
};

type TrackChoiceParams = SuggestionParams & {
  readonly actions: SuggestionActions;
};

type TaskParams = {
  readonly key: string;
  readonly task: () => Promise<void>;
};

export type SuggestionRunner = {
  readonly pending: PendingAction;
  readonly notNowIds: ReadonlySet<string>;
  readonly trackedActions: (params: SuggestionParams) => SuggestionActions;
  readonly trackChoiceFor: (params: TrackChoiceParams) => ActionTrack;
  readonly onNotNow: (params: SuggestionParams) => void;
};

type ErrorParams = {
  readonly error: unknown;
};

const messageOf = ({ error }: ErrorParams): string =>
  error instanceof Error ? error.message : String(error);

export const useSuggestionRunner = ({
  session,
  agents,
  onSelectQuestions,
  onFailure,
}: Params): SuggestionRunner => {
  const sessionId = session.id;
  const actionsFor = useSuggestionActions({ session, agents, onSelectQuestions });
  const pending = usePendingAction({ sessionId });
  const [notNowIds, setNotNowIds] = useState<ReadonlySet<string>>(new Set());
  const showToast = useShowToast();
  const undoable = useAppStore((state) => state.undoable);
  const isMountedRef = useRef(false);
  const inFlightRef = useRef(new Set<string>());

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const guarded = useCallback(
    ({ key, task }: TaskParams): (() => Promise<void>) => {
      if (onFailure === undefined) {
        return task;
      }
      return async () => {
        try {
          await task();
        } catch (error) {
          const message = messageOf({ error });
          onFailure({ key, message });
          throw new ReportedError(message);
        }
      };
    },
    [onFailure],
  );

  const onNotNow = ({ suggestion }: SuggestionParams) => {
    setNotNowIds((current) => new Set([...current, suggestion.id]));
    const recorded = recordNextStepOutcome({
      sessionId,
      kind: suggestion.kind,
      outcome: 'dismissed',
      fingerprint: suggestion.fingerprint,
    });
    const dismiss = actionsFor({ suggestion }).onDismiss;
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

  const runTracked = ({
    suggestion,
    key,
    failureTitle,
    task,
  }: SuggestionParams & TaskParams & { readonly failureTitle: string }): Promise<void> => {
    if (inFlightRef.current.has(key)) {
      return Promise.resolve();
    }
    inFlightRef.current.add(key);
    void recordNextStepOutcome({
      sessionId,
      kind: suggestion.kind,
      outcome: 'accepted',
      fingerprint: suggestion.fingerprint,
    });
    return pending
      .run({ key, failureTitle, task: guarded({ key, task }) })
      .then(() => undefined)
      .finally(() => {
        inFlightRef.current.delete(key);
      });
  };

  const trackedActions = ({ suggestion }: SuggestionParams): SuggestionActions => {
    const actions = actionsFor({ suggestion });
    const primary = actions.primary;
    if (primary === null) {
      return actions;
    }
    const runsOn = primary.runsOn;
    const tracked =
      ({ key, task }: TaskParams) =>
      () =>
        runTracked({ suggestion, key, failureTitle: primary.failureTitle, task });
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
    ({ suggestion, actions }: TrackChoiceParams): ActionTrack =>
    ({ actionId, task }) =>
      runTracked({
        suggestion,
        key: choiceKey({ suggestion, choiceId: actionId }),
        failureTitle: actions.primary?.failureTitle ?? CHOICE_FAILURE_TITLE,
        task: async () => {
          await task();
        },
      });

  return { pending, notNowIds, trackedActions, trackChoiceFor, onNotNow };
};
