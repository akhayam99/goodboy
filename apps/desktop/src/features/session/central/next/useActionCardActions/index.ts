import { useCallback, useRef, useState } from 'react';
import type { ConfirmRole } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  agentPlace,
  branchPlace,
  sessionPlace,
  useAppStore,
} from '../../../../../store';
import { ReportedError } from '../../../../../store/slices/notifications/reportedError';
import type {
  ActionCardActionTarget,
  ActionTrack,
  SuggestionActionTarget,
} from '../../../../actions/types';
import { autoTreeOfAgent } from '../../../../auto/autoTreeOfAgent';
import { useIsAutoOn } from '../../../../auto/useIsAutoOn';
import { pendingChoiceIds } from '../../../../suggestions/pendingChoiceIds';
import { useSuggestionRunner } from '../../../../suggestions/useSuggestionRunner';
import type { SessionSuggestion } from '../../../../suggestions/types';
import type { AgentKind } from '../../../agent-kind';
import { useTimelineOpen } from '../../../hooks/useTimelineOpen';
import type { NeedsYouOwner } from '../../../timeline/needsYou';
import type { ActionCardModel, AutoActionTarget } from '../actionCardsOf';
import { foldSecondVerb } from '../foldSecondVerb';
import { useOpenNeedsYou } from '../useOpenNeedsYou';

type Params = {
  readonly session: Session;
};

export type CardVerb = {
  readonly label: string;
  readonly ariaLabel: string | undefined;
  readonly isDisabled: boolean;
  readonly isBusy: boolean;
  readonly confirmRole: ConfirmRole | null;
  readonly hasPicker: boolean;
  readonly run: () => void;
};

type CardMenu = {
  readonly target: SuggestionActionTarget;
  readonly pendingChoiceIds: ReadonlySet<string>;
  readonly isHeld: boolean;
  readonly isDisabled: boolean;
  readonly trackChoice: ActionTrack;
};

export type CardActions = {
  readonly main: CardVerb | null;
  readonly second: CardVerb | null;
  readonly failure: string | null;
  readonly isBusy: boolean;
  readonly agentKind: AgentKind | null;
  readonly menu: CardMenu | null;
  readonly foldedTarget: ActionCardActionTarget | null;
};

export type ActionCardActions = {
  readonly actionsFor: (params: ActionsParams) => CardActions;
  readonly isHidden: (params: CardParams) => boolean;
};

type OwnerParams = {
  readonly owner: NeedsYouOwner;
};

type KeyParams = {
  readonly key: string;
};

type FailureParams = KeyParams & {
  readonly message: string;
};

type RunOnceParams = KeyParams & {
  readonly task: () => Promise<void>;
};

type AutoParams = {
  readonly target: AutoActionTarget;
};

type CardParams = {
  readonly card: ActionCardModel;
};

type ActionsParams = CardParams & {
  readonly isNarrow?: boolean;
};

type SuggestionParams = {
  readonly suggestion: SessionSuggestion;
};

type VerbParams = {
  readonly label: string;
  readonly ariaLabel?: string;
  readonly run: () => void;
  readonly isBusy?: boolean;
  readonly isDisabled?: boolean;
  readonly confirmRole?: ConfirmRole | null;
  readonly hasPicker?: boolean;
};

const ownerVerbOf = ({ owner }: OwnerParams): string => {
  if (owner.kind === 'question' || owner.question !== null) {
    return 'Answer';
  }
  switch (owner.kind) {
    case 'fixRun':
      return 'Open comments';
    case 'rebase':
      return 'Open rebase';
    case 'run':
    case 'agent':
      return 'Open';
    default: {
      const exhaustive: never = owner.kind;
      return exhaustive;
    }
  }
};

type ErrorParams = {
  readonly error: unknown;
};

const messageOf = ({ error }: ErrorParams): string =>
  error instanceof Error ? error.message : String(error);

const RETRY_LABEL = 'Retry';

const CONFIRM_ROLE: Partial<Record<SessionSuggestion['kind'], ConfirmRole>> = {
  'close-worktree': 'danger',
};

const verbOf = ({
  label,
  ariaLabel,
  run,
  isBusy = false,
  isDisabled = false,
  confirmRole = null,
  hasPicker = false,
}: VerbParams): CardVerb => ({
  label,
  ariaLabel,
  isDisabled,
  isBusy,
  confirmRole,
  hasPicker,
  run,
});

export const useActionCardActions = ({ session }: Params): ActionCardActions => {
  const sessionId = session.id;
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const navigate = useAppStore((s) => s.navigate);
  const loadAutoTrees = useAppStore((s) => s.loadAutoTrees);
  const continueStoppedAgent = useAppStore((s) => s.continueStoppedAgent);
  const isAutoOn = useIsAutoOn();
  const openTargetFor = useTimelineOpen({ sessionId });
  const openNeedsYou = useOpenNeedsYou({ sessionId, openTargetFor });
  const [failures, setFailures] = useState<ReadonlyMap<string, string>>(new Map());
  const [droppedIds, setDroppedIds] = useState<ReadonlySet<string>>(new Set());
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(new Set<string>());

  const setFailure = useCallback(({ key, message }: FailureParams) => {
    setFailures((current) => new Map(current).set(key, message));
  }, []);

  const clearFailure = useCallback(({ key }: KeyParams) => {
    setFailures((current) => {
      if (!current.has(key)) {
        return current;
      }
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  }, []);

  const runner = useSuggestionRunner({
    session,
    agents,
    onSelectQuestions: () => navigate({ to: sessionPlace({ sessionId, lens: 'questions' }) }),
    onFailure: setFailure,
  });

  const runOnce = async ({ key, task }: RunOnceParams): Promise<void> => {
    if (inFlight.current.has(key)) {
      return;
    }
    inFlight.current.add(key);
    clearFailure({ key });
    setBusyIds((current) => new Set(current).add(key));
    try {
      await task();
    } catch (error) {
      if (!(error instanceof ReportedError)) {
        setFailure({ key, message: messageOf({ error }) });
      }
    } finally {
      inFlight.current.delete(key);
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  const retryAuto = async ({ card, target }: CardParams & AutoParams): Promise<void> => {
    await loadAutoTrees({ sessionId });
    if (target.kind === 'neverStarted') {
      const state = useAppStore.getState();
      const found = autoTreeOfAgent({
        views: state.autoTreeViews[sessionId] ?? EMPTY_ARRAY,
        agentId: target.agentId,
      });
      const child = (state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY).find(
        (agent) => agent.id === target.agentId,
      );
      const isQueued =
        found?.kind === 'child' &&
        (found.delegation.state === 'accepted' || found.delegation.state === 'starting') &&
        found.delegation.settledAt === null;
      if (!isQueued || child?.startedAt !== undefined) {
        setDroppedIds((current) => new Set(current).add(card.id));
        return;
      }
    }
    await continueStoppedAgent({ sessionId, agentId: target.agentId });
  };

  const openAuto = ({ target }: AutoParams) =>
    navigate({ to: agentPlace({ sessionId, agentId: target.rootAgentId }) });

  const ownerActions = ({ owner }: OwnerParams): CardActions => ({
    main: verbOf({
      label: ownerVerbOf({ owner }),
      run: () => openNeedsYou({ owner }),
    }),
    second: null,
    failure: null,
    isBusy: false,
    agentKind: null,
    menu: null,
    foldedTarget: null,
  });

  const autoActions = ({ card, target }: CardParams & AutoParams): CardActions => {
    const key = card.id;
    const isBusy = busyIds.has(key);
    const failure = failures.get(key) ?? null;
    const open = verbOf({ label: 'Open Auto', run: () => openAuto({ target }) });
    const review = verbOf({ label: 'Review plan', run: () => openAuto({ target }) });
    const canRetry = target.canRetry && target.kind !== 'approve' && target.kind !== 'blocked';
    if (!canRetry) {
      return {
        main: target.kind === 'approve' ? review : open,
        second: null,
        failure,
        isBusy: false,
        agentKind: null,
        menu: null,
        foldedTarget: null,
      };
    }
    return {
      main: verbOf({
        label: RETRY_LABEL,
        ariaLabel: `${RETRY_LABEL} "${target.role}"`,
        isBusy,
        run: () => void runOnce({ key, task: () => retryAuto({ card, target }) }),
      }),
      second: open,
      failure,
      isBusy,
      agentKind: null,
      menu: null,
      foldedTarget: null,
    };
  };

  const suggestionActions = ({ suggestion }: SuggestionParams): CardActions => {
    const actions = runner.trackedActions({ suggestion });
    const primary = actions.primary;
    const { pendingKeys } = runner.pending;
    const choiceIds = pendingChoiceIds({ suggestion, pendingKeys });
    const isPending = pendingKeys.has(suggestion.id);
    const isChoicePending = choiceIds.size > 0;
    const isActionBusy = isPending || isChoicePending || primary?.isBusy === true;
    const failureKey = [...failures.keys()].find(
      (key) => key === suggestion.id || key.startsWith(`${suggestion.id}:choice:`),
    );
    const failure = failureKey === undefined ? null : (failures.get(failureKey) ?? null);
    const visibleLabel = primary?.shortLabel ?? primary?.label ?? '';
    const retryTitle = primary?.label ?? '';
    const agentKind = primary?.agentKind ?? null;
    const openCheck =
      suggestion.kind === 'fix-checks'
        ? verbOf({
            label: 'Open check',
            run: () => {
              const state = useAppStore.getState();
              const mountPath =
                (state.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY).find(
                  (mount) => mount.mountId === suggestion.payload.mountId,
                )?.worktreePath ?? null;
              navigate({ to: branchPlace({ sessionId, mountPath, tab: 'checks' }) });
            },
          })
        : null;
    const target: SuggestionActionTarget = {
      kind: 'suggestion',
      sessionId,
      suggestion,
      startsRole: agentKind,
      isAutoOn,
      onNotNow: () => runner.onNotNow({ suggestion }),
    };
    return {
      main:
        primary === null
          ? null
          : verbOf({
              label: failure === null ? visibleLabel : RETRY_LABEL,
              ariaLabel:
                failure !== null
                  ? `Retry ${retryTitle}`
                  : visibleLabel === primary.label
                    ? undefined
                    : primary.label,
              isDisabled: primary.isDisabled || (isChoicePending && !isPending),
              isBusy: isPending,
              confirmRole:
                primary.requiresConfirm === true
                  ? (CONFIRM_ROLE[suggestion.kind] ?? 'primary')
                  : null,
              hasPicker: primary.shouldOpenPicker === true,
              run: () => {
                clearFailure({ key: suggestion.id });
                void primary.run();
              },
            }),
      second: openCheck,
      failure,
      isBusy: isActionBusy,
      agentKind,
      menu: {
        target,
        pendingChoiceIds: choiceIds,
        isHeld: primary?.isDisabled === true || isPending || isChoicePending,
        isDisabled: isActionBusy,
        trackChoice: runner.trackChoiceFor({ suggestion, actions }),
      },
      foldedTarget: null,
    };
  };

  const baseActionsFor = ({ card }: CardParams): CardActions => {
    const { source } = card;
    switch (source.kind) {
      case 'owner':
        return ownerActions({ owner: source.owner });
      case 'suggestion':
        return suggestionActions({ suggestion: source.suggestion });
      case 'auto':
        return autoActions({ card, target: source.target });
      default: {
        const exhaustive: never = source;
        return exhaustive;
      }
    }
  };

  const actionsFor = ({ card, isNarrow = false }: ActionsParams): CardActions => {
    const actions = baseActionsFor({ card });
    return isNarrow ? foldSecondVerb({ actions, sessionId }) : actions;
  };

  const isHidden = ({ card }: CardParams): boolean =>
    droppedIds.has(card.id) ||
    (card.source.kind === 'suggestion' && runner.notNowIds.has(card.source.suggestion.id));

  return { actionsFor, isHidden };
};
