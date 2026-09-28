import { getDraftHistoryPlan, markHistoryPlan, saveDraftHistoryPlan } from '@goodboy/db';
import type { BranchCommit, HistoryGraph, HistoryStep, MountId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { predictHistoryPlan, readHistoryGraph } from '../../../features/history/historyEngine';
import { initialPlanItems, normalizePlanItems } from '../../../features/history/historyPlan';
import { listBranchCommits } from '../../../features/worktree/worktree';
import { tauriDatabase } from '../../../shared/lib/db';
import { historyTargetOf } from './historyTargetOf';
import type {
  EditHistoryDraftInput,
  GetFn,
  HistoryDraft,
  HistoryDraftPlan,
  HistoryMountInput,
  SetFn,
} from './types';

const PREDICT_DELAY_MS = 250;
const UNDO_LIMIT = 50;

const timers = new Map<MountId, ReturnType<typeof setTimeout>>();
const sequence = new Map<MountId, number>();

type PatchParams = {
  readonly set: SetFn;
  readonly mountId: MountId;
  readonly patch: Partial<HistoryDraft>;
};

const patchDraft = ({ set, mountId, patch }: PatchParams): void => {
  set((state) => {
    const current = state.historyDrafts[mountId];
    if (current === undefined) {
      return state;
    }
    return { historyDrafts: { ...state.historyDrafts, [mountId]: { ...current, ...patch } } };
  });
};

const isStillValid = ({
  items,
  commits,
}: {
  readonly items: ReadonlyArray<HistoryStep>;
  readonly commits: ReadonlyArray<BranchCommit>;
}): boolean => {
  const shas = new Set(commits.map((commit) => commit.sha));
  return items.length === commits.length && items.every((step) => shas.has(step.sha));
};

type PredictParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly mountId: MountId;
  readonly delayMs: number;
};

const schedulePrediction = ({ set, get, mountId, delayMs }: PredictParams): void => {
  const pending = timers.get(mountId);
  if (pending !== undefined) {
    clearTimeout(pending);
  }
  patchDraft({ set, mountId, patch: { isPredicting: true } });
  timers.set(
    mountId,
    setTimeout(() => {
      timers.delete(mountId);
      const draft = get().historyDrafts[mountId];
      if (draft === undefined) {
        return;
      }
      const ticket = (sequence.get(mountId) ?? 0) + 1;
      sequence.set(mountId, ticket);
      const worktreePath = historyTargetOf({
        get,
        sessionId: draft.sessionId,
        mountId,
      }).worktreePath;
      void predictHistoryPlan({
        worktreePath,
        base: draft.baseSha,
        head: draft.headSha,
        steps: draft.items,
        onto: draft.onto,
      })
        .then((prediction) => {
          if (sequence.get(mountId) !== ticket) {
            return;
          }
          patchDraft({ set, mountId, patch: { prediction, isPredicting: false } });
        })
        .catch((error: unknown) => {
          if (sequence.get(mountId) !== ticket) {
            return;
          }
          patchDraft({
            set,
            mountId,
            patch: { isPredicting: false, prediction: null, loadError: formatError(error) },
          });
        });
    }, delayMs),
  );
};

type EmptyParams = HistoryMountInput & {
  readonly branch: string;
  readonly loadError: string | null;
};

const emptyDraft = ({ sessionId, mountId, branch, loadError }: EmptyParams): HistoryDraft => ({
  sessionId,
  mountId,
  planId: null,
  branch,
  baseSha: '',
  headSha: '',
  commits: [],
  items: [],
  onto: null,
  graph: null,
  undo: [],
  prediction: null,
  isPredicting: false,
  loadError,
});

export const loadHistoryDraft = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, mountId }: HistoryMountInput): Promise<void> => {
    const target = historyTargetOf({ get, sessionId, mountId });
    try {
      const [commits, graph] = await Promise.all([
        listBranchCommits(target.worktreePath),
        readHistoryGraph({
          worktreePath: target.worktreePath,
          baseBranch: target.baseBranch,
          branch: target.branch,
        }).catch((): HistoryGraph | null => null),
      ]);
      const head = commits[0]?.sha ?? '';
      const base = commits[commits.length - 1]?.parentSha ?? head;
      const stored = await getDraftHistoryPlan({ db: tauriDatabase, mountId });
      const isStoredValid =
        stored !== null &&
        stored.headSha === head &&
        stored.baseSha === base &&
        isStillValid({ items: stored.items, commits });
      const items = normalizePlanItems({
        items: isStoredValid ? stored.items : initialPlanItems({ commits }),
      });
      const previous = get().historyDrafts[mountId];
      const isSameBranch =
        previous !== undefined && previous.headSha === head && previous.baseSha === base;
      set((state) => ({
        historyDrafts: {
          ...state.historyDrafts,
          [mountId]: {
            sessionId,
            mountId,
            planId: isStoredValid ? stored.id : null,
            branch: target.branch,
            baseSha: base,
            headSha: head,
            commits,
            items,
            onto: isSameBranch ? previous.onto : null,
            graph,
            undo: isSameBranch ? previous.undo : [],
            prediction: null,
            isPredicting: false,
            loadError: null,
          },
        },
      }));
      if (commits.length > 0) {
        schedulePrediction({ set, get, mountId, delayMs: 0 });
      }
    } catch (error) {
      set((state) => ({
        historyDrafts: {
          ...state.historyDrafts,
          [mountId]: emptyDraft({
            sessionId,
            mountId,
            branch: target.branch,
            loadError: formatError(error),
          }),
        },
      }));
    }
  };
};

type StoreParams = HistoryMountInput & {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly plan: HistoryDraftPlan;
  readonly undo: ReadonlyArray<HistoryDraftPlan>;
};

const storePlan = async ({ set, get, sessionId, mountId, plan, undo }: StoreParams) => {
  const draft = get().historyDrafts[mountId];
  if (draft === undefined) {
    return;
  }
  patchDraft({ set, mountId, patch: { items: plan.items, onto: plan.onto, undo } });
  schedulePrediction({ set, get, mountId, delayMs: PREDICT_DELAY_MS });
  const saved = await saveDraftHistoryPlan({
    db: tauriDatabase,
    sessionId,
    mountId,
    branch: draft.branch,
    baseSha: draft.baseSha,
    headSha: draft.headSha,
    items: plan.items,
    at: Date.now(),
  });
  patchDraft({ set, mountId, patch: { planId: saved.id } });
};

const pushUndo = ({ draft }: { readonly draft: HistoryDraft }): ReadonlyArray<HistoryDraftPlan> => [
  ...draft.undo.slice(-(UNDO_LIMIT - 1)),
  { items: draft.items, onto: draft.onto },
];

export const editHistoryDraft = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, mountId, items, onto }: EditHistoryDraftInput): Promise<void> => {
    const draft = get().historyDrafts[mountId];
    if (draft === undefined || draft.sessionId !== sessionId) {
      return;
    }
    const nextOnto = onto === undefined ? draft.onto : onto;
    if (items === draft.items && nextOnto === draft.onto) {
      return;
    }
    await storePlan({
      set,
      get,
      sessionId,
      mountId,
      plan: { items, onto: nextOnto },
      undo: pushUndo({ draft }),
    });
  };
};

export const undoHistoryDraft = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, mountId }: HistoryMountInput): Promise<boolean> => {
    const draft = get().historyDrafts[mountId];
    const previous = draft?.undo[draft.undo.length - 1];
    if (draft === undefined || draft.sessionId !== sessionId || previous === undefined) {
      return false;
    }
    await storePlan({
      set,
      get,
      sessionId,
      mountId,
      plan: previous,
      undo: draft.undo.slice(0, -1),
    });
    return true;
  };
};

export const discardHistoryDraft = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, mountId }: HistoryMountInput): Promise<void> => {
    const draft = get().historyDrafts[mountId];
    if (draft === undefined || draft.sessionId !== sessionId) {
      return;
    }
    if (draft.planId !== null) {
      await markHistoryPlan({
        db: tauriDatabase,
        id: draft.planId,
        state: 'discarded',
        at: Date.now(),
      });
    }
    patchDraft({
      set,
      mountId,
      patch: {
        planId: null,
        items: initialPlanItems({ commits: draft.commits }),
        onto: null,
        undo: pushUndo({ draft }),
      },
    });
    schedulePrediction({ set, get, mountId, delayMs: 0 });
  };
};
