import { getDraftHistoryPlan, markHistoryPlan, saveDraftHistoryPlan } from '@goodboy/db';
import type { BranchCommit, HistoryPlanPrediction, HistoryStep, MountId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { predictHistoryPlan } from '../../../features/history/historyEngine';
import { initialPlanItems, type HistoryEdit } from '../../../features/history/historyPlan';
import { listBranchCommits } from '../../../features/worktree/worktree';
import { tauriDatabase } from '../../../shared/lib/db';
import { historyTargetOf } from './historyTargetOf';
import type { EditHistoryDraftInput, GetFn, HistoryDraft, HistoryMountInput, SetFn } from './types';

const PREDICT_DELAY_MS = 250;

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

const hasConflict = ({
  prediction,
}: {
  readonly prediction: HistoryPlanPrediction | null;
}): boolean => prediction !== null && prediction.steps.some((step) => step.outcome === 'conflict');

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
  readonly edit: HistoryEdit | null;
  readonly delayMs: number;
};

const schedulePrediction = ({ set, get, mountId, edit, delayMs }: PredictParams): void => {
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
      })
        .then((prediction) => {
          if (sequence.get(mountId) !== ticket) {
            return;
          }
          const previous = get().historyDrafts[mountId];
          const wasConflicting = hasConflict({ prediction: previous?.prediction ?? null });
          const isConflicting = hasConflict({ prediction });
          patchDraft({
            set,
            mountId,
            patch: {
              prediction,
              isPredicting: false,
              conflictEdit: !isConflicting
                ? null
                : wasConflicting
                  ? (previous?.conflictEdit ?? edit)
                  : edit,
            },
          });
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

export const loadHistoryDraft = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, mountId }: HistoryMountInput): Promise<void> => {
    const target = historyTargetOf({ get, sessionId, mountId });
    try {
      const commits = await listBranchCommits(target.worktreePath);
      const head = commits[0]?.sha ?? '';
      const base = commits[commits.length - 1]?.parentSha ?? head;
      const stored = await getDraftHistoryPlan({ db: tauriDatabase, mountId });
      const isStoredValid =
        stored !== null &&
        stored.headSha === head &&
        stored.baseSha === base &&
        isStillValid({ items: stored.items, commits });
      const items = isStoredValid ? stored.items : initialPlanItems({ commits });
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
            prediction: null,
            isPredicting: false,
            lastEdit: null,
            conflictEdit: null,
            loadError: null,
          },
        },
      }));
      if (commits.length > 0) {
        schedulePrediction({ set, get, mountId, edit: null, delayMs: 0 });
      }
    } catch (error) {
      set((state) => ({
        historyDrafts: {
          ...state.historyDrafts,
          [mountId]: {
            sessionId,
            mountId,
            planId: null,
            branch: target.branch,
            baseSha: '',
            headSha: '',
            commits: [],
            items: [],
            prediction: null,
            isPredicting: false,
            lastEdit: null,
            conflictEdit: null,
            loadError: formatError(error),
          },
        },
      }));
    }
  };
};

export const editHistoryDraft = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, mountId, items, edit }: EditHistoryDraftInput): Promise<void> => {
    const draft = get().historyDrafts[mountId];
    if (draft === undefined || draft.sessionId !== sessionId) {
      return;
    }
    patchDraft({ set, mountId, patch: { items, lastEdit: edit } });
    schedulePrediction({ set, get, mountId, edit, delayMs: PREDICT_DELAY_MS });
    const saved = await saveDraftHistoryPlan({
      db: tauriDatabase,
      sessionId,
      mountId,
      branch: draft.branch,
      baseSha: draft.baseSha,
      headSha: draft.headSha,
      items,
      at: Date.now(),
    });
    patchDraft({ set, mountId, patch: { planId: saved.id } });
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
        lastEdit: null,
        conflictEdit: null,
      },
    });
    schedulePrediction({ set, get, mountId, edit: null, delayMs: 0 });
  };
};
