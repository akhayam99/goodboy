import { useCallback, useRef, useState } from 'react';
import type { ConfirmRole } from '@goodboy/ui';
import type { MountId, Session } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  agentPlace,
  branchPlace,
  sessionPlace,
  useAppStore,
} from '../../../../../store';
import { ReportedError } from '../../../../../store/slices/notifications/reportedError';
import type { RebaseAllRun } from '../../../../../store/slices/rebaseAll/types';
import type {
  ActionCardActionTarget,
  ActionTrack,
  FoldedVerb,
  SuggestionActionTarget,
} from '../../../../actions/types';
import { autoTreeOfAgent } from '../../../../auto/autoTreeOfAgent';
import { autoUnavailableReason } from '../../../../auto/autoUnavailableReason';
import type { RebaseStopRow } from '../../../../history/rebaseStopRowOf';
import { useRebaseStopRows } from '../../../../history/useRebaseStopRows';
import { selectWritableMounts } from '../../../../../store/slices/project-mounts/selectors';
import { captureStartHint } from '../../../../../store/slices/startHints/captureStartHint';
import { START_HINT_SCOPES } from '../../../../../store/slices/startHints/startHintScopes';
import { useIsAutoOn } from '../../../../auto/useIsAutoOn';
import { pendingChoiceIds } from '../../../../suggestions/pendingChoiceIds';
import { useSuggestionRunner } from '../../../../suggestions/useSuggestionRunner';
import type { SessionSuggestion } from '../../../../suggestions/types';
import type { AgentKind } from '../../../agent-kind';
import { useTimelineOpen } from '../../../hooks/useTimelineOpen';
import type { NeedsYouOwner } from '../../../timeline/needsYou';
import type { ActionCardModel, AutoActionTarget } from '../actionCardsOf';
import { foldSecondVerb } from '../foldSecondVerb';
import { foldVerbs } from '../foldVerbs';
import { suggestionPlaceOf } from '../suggestionPlaceOf';
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
  readonly openFor: (params: CardParams) => (() => void) | null;
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

type TaskParams = {
  readonly task: () => Promise<unknown>;
};

type LaterParams = TaskParams & {
  readonly key: string;
};

type StopVerbParams = {
  readonly row: RebaseStopRow;
  readonly owner: NeedsYouOwner;
  readonly mountId: MountId;
  readonly key: string;
};

type BatchParams = {
  readonly batch: RebaseAllRun | undefined;
  readonly mountId: MountId;
};

const batchFailureOf = ({ batch, mountId }: BatchParams): string | null => {
  if (batch === undefined || batch.phase !== 'done') {
    return null;
  }
  const branch = batch.branches.find((candidate) => candidate.mountId === mountId);
  return branch?.state === 'failed' ? branch.message : null;
};

type ErrorParams = {
  readonly error: unknown;
};

const messageOf = ({ error }: ErrorParams): string =>
  error instanceof Error ? error.message : String(error);

const RETRY_LABEL = 'Retry';

const GONE_REASON = 'This agent is no longer in this session. It was deleted or moved.';

const foldedLabelOf = ({ card }: CardParams): string => card.title;

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
  const stopRowFor = useRebaseStopRows({ sessionId });
  const batch = useAppStore((s) => s.rebaseAllRuns[sessionId]);
  const autoBlockedReason = useAppStore((s) => autoUnavailableReason({ state: s }));
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
    const state = useAppStore.getState();
    const found = autoTreeOfAgent({
      views: state.autoTreeViews[sessionId] ?? EMPTY_ARRAY,
      agentId: target.agentId,
    });
    const child = (state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY).find(
      (agent) => agent.id === target.agentId,
    );
    if (found?.kind !== 'child') {
      setFailure({ key: card.id, message: GONE_REASON });
      return;
    }
    if (target.kind === 'neverStarted') {
      const isQueued =
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

  const runLater =
    ({ key, task }: LaterParams) =>
    (): void =>
      void runOnce({
        key,
        task: async () => {
          await task();
        },
      });

  const stopMainOf = ({ row, owner, mountId, key }: StopVerbParams): Omit<VerbParams, 'isBusy'> => {
    const store = useAppStore.getState;
    const runIt = ({ task }: TaskParams) => runLater({ key, task });
    switch (row.verb) {
      case 'resolve-auto':
        return {
          label: 'Resolve with Auto',
          isDisabled: autoBlockedReason !== null,
          run: runIt({
            task: () => {
              const state = store();
              const capture = captureStartHint({
                state,
                sessionId,
                scope: START_HINT_SCOPES.rebase({ mountId }),
              });
              return state.resolveRebaseWithAuto({
                sessionId,
                mountIds: [mountId],
                hint: capture.text,
                onAccepted: () => store().settleStartHint({ capture }),
              });
            },
          }),
        };
      case 'bring-in':
        return {
          label: 'Bring them in',
          run: runIt({ task: () => store().bringOriginInAndPush({ sessionId, mountId }) }),
        };
      case 'retry-rebase':
        return {
          label: 'Retry rebase',
          run: runIt({ task: () => store().rebaseBranch({ sessionId, mountId }) }),
        };
      case 'fix-push':
        return {
          label: 'Fix with agent',
          run: runIt({
            task: () => {
              const state = store();
              state.adoptRebaseStop({ sessionId, mountId });
              return state.fixPushWithAgent({ sessionId, mountId });
            },
          }),
        };
      case 'open':
        return { label: ownerVerbOf({ owner }), run: () => openNeedsYou({ owner }) };
      default: {
        const exhaustive: never = row.verb;
        return exhaustive;
      }
    }
  };

  const stopActions = ({ card, owner }: CardParams & OwnerParams): CardActions => {
    const mount = selectWritableMounts({ state: useAppStore.getState(), sessionId }).find(
      (candidate) => candidate.mountId === owner.mountId,
    );
    const row = mount === undefined ? null : stopRowFor({ mountId: mount.mountId });
    if (mount === undefined || row === null) {
      return ownerActions({ owner });
    }
    const mountId = mount.mountId;
    const key = card.id;
    const isBusy = busyIds.has(key);
    const store = useAppStore.getState;
    const later = ({ task }: TaskParams) => runLater({ key, task });
    const main = stopMainOf({ row, owner, mountId, key });
    const verbs: ReadonlyArray<FoldedVerb> = [
      ...(row.isAsking
        ? [
            {
              id: `${key}:myself`,
              label: 'Resolve myself',
              run: later({ task: () => store().resolveRebaseMyself({ sessionId, mountId }) }),
            },
          ]
        : []),
      ...(row.state === 'origin-moved' && row.hasBackup
        ? [
            {
              id: `${key}:undo`,
              label: 'Undo rebase',
              run: later({
                task: async () => {
                  const state = store();
                  const run = state.adoptRebaseStop({ sessionId, mountId });
                  if (run === null || run.backupRef === null) {
                    return;
                  }
                  await state.restoreHistory({
                    sessionId,
                    mountId,
                    backupRef: run.backupRef,
                    shouldPush: false,
                  });
                },
              }),
            },
          ]
        : []),
      ...(row.canKeep
        ? [
            {
              id: `${key}:keep`,
              label: 'Keep branch as it was',
              run: later({ task: () => store().keepRebaseStop({ sessionId, mountId }) }),
            },
          ]
        : []),
      { id: `${key}:open`, label: 'Open branch', run: () => openNeedsYou({ owner }) },
    ];
    return {
      main: verbOf({
        ...main,
        ariaLabel: `${main.label} on ${mount.branch}`,
        isBusy,
      }),
      second: null,
      failure: failures.get(key) ?? batchFailureOf({ batch, mountId }),
      isBusy,
      agentKind: null,
      menu: null,
      foldedTarget: { kind: 'actionCard', sessionId, verbs },
    };
  };

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
        return source.owner.kind === 'rebase'
          ? stopActions({ card, owner: source.owner })
          : ownerActions({ owner: source.owner });
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
    const base = baseActionsFor({ card });
    const actions = isNarrow ? foldSecondVerb({ actions: base, sessionId }) : base;
    const inner = card.folded.map((folded) => ({
      folded,
      folds: baseActionsFor({ card: folded }),
    }));
    const verbs = inner.flatMap(({ folded, folds }): ReadonlyArray<FoldedVerb> =>
      folds.main === null
        ? []
        : [
            {
              id: `folded:${folded.id}`,
              label: foldedLabelOf({ card: folded }),
              run: folds.main.run,
            },
          ],
    );
    const innerFailure = inner.find(({ folds }) => folds.failure !== null)?.folds.failure ?? null;
    return foldVerbs({
      actions: {
        ...actions,
        failure: actions.failure ?? innerFailure,
        isBusy: actions.isBusy || inner.some(({ folds }) => folds.isBusy),
      },
      sessionId,
      verbs,
    });
  };

  const isHidden = ({ card }: CardParams): boolean =>
    droppedIds.has(card.id) ||
    (card.source.kind === 'suggestion' && runner.notNowIds.has(card.source.suggestion.id));

  const openFor = ({ card }: CardParams): (() => void) | null => {
    const { source } = card;
    if (source.kind === 'owner') {
      return () => openNeedsYou({ owner: source.owner });
    }
    if (source.kind === 'auto') {
      const { target } = source;
      const agentId =
        target.kind === 'approve' || target.kind === 'blocked'
          ? target.rootAgentId
          : target.agentId;
      return () => navigate({ to: agentPlace({ sessionId, agentId }) });
    }
    const place = suggestionPlaceOf({ suggestion: source.suggestion, mountId: card.mountId });
    if (place === null) {
      return null;
    }
    return () => {
      const mountPath =
        place.kind === 'branch'
          ? ((useAppStore.getState().sessionProjectMounts[sessionId] ?? EMPTY_ARRAY).find(
              (mount) => mount.mountId === place.mountId,
            )?.worktreePath ?? null)
          : null;
      navigate({
        to:
          place.kind === 'questions'
            ? sessionPlace({ sessionId, lens: 'questions' })
            : branchPlace({ sessionId, mountPath, tab: place.tab }),
      });
    };
  };

  return { actionsFor, isHidden, openFor };
};
