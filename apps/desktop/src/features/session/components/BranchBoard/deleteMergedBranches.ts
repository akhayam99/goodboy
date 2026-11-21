import type { MountCleanupProposal, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import type { ActionFailure } from '../../../../store/slices/notifications/reportErrors';
import { cleanUpRefusalOf } from '../../../actions/kinds/cleanUpRefusalOf';
import { mergedMountsOf } from '../../../actions/kinds/mergedMountsOf';

type BusyParams = {
  readonly mountId: MountId;
  readonly isBusy: boolean;
};

type OnBusy = (params: BusyParams) => void;

type Params = {
  readonly sessionId: SessionId;
  readonly proposals: ReadonlyArray<MountCleanupProposal>;
  readonly onBusy?: OnBusy;
};

type Deleted = {
  readonly id: string;
  readonly mountId: MountId;
  readonly branch: string;
};

type Pending = {
  readonly proposal: MountCleanupProposal;
  readonly step: 'delete' | 'settle';
};

type Failed = {
  readonly pending: Pending;
  readonly failure: ActionFailure;
};

type Attempt = {
  readonly deleted: Deleted | null;
  readonly failed: Failed | null;
};

type TitleParams = {
  readonly branch: string;
};

const branchDeleteTitleOf = ({ branch }: TitleParams): string =>
  `Couldn't delete the local branch ${branch}`;

const settleTitleOf = ({ branch }: TitleParams): string =>
  `Couldn't finish deleting the local branch ${branch}`;

type StepParams = {
  readonly sessionId: SessionId;
  readonly proposal: MountCleanupProposal;
};

const settleOne = async ({ sessionId, proposal }: StepParams): Promise<Failed | null> => {
  try {
    await useAppStore
      .getState()
      .settleMountCleanup({ sessionId, mountId: proposal.mountId, outcome: 'removed' });
    return null;
  } catch (error) {
    return {
      pending: { proposal, step: 'settle' },
      failure: { title: settleTitleOf({ branch: proposal.branch }), error },
    };
  }
};

type DeleteFailureParams = {
  readonly proposal: MountCleanupProposal;
  readonly error: unknown;
};

const deleteFailureOf = ({ proposal, error }: DeleteFailureParams): Attempt => ({
  deleted: null,
  failed: {
    pending: { proposal, step: 'delete' },
    failure: { title: branchDeleteTitleOf({ branch: proposal.branch }), error },
  },
});

const deleteOne = async ({ sessionId, proposal }: StepParams): Promise<Attempt> => {
  const state = useAppStore.getState();
  const merged = mergedMountsOf({ state, sessionId }).find(
    (mount) => mount.mountId === proposal.mountId,
  );
  try {
    const outcome = await state.runAfterMergeCleanup({
      sessionId,
      mountId: proposal.mountId,
      expectedBranch: proposal.branch,
      mergedHeadSha: merged?.mergedHeadSha ?? null,
      isRequested: true,
      isLocalOnly: true,
      isRemovalRequired: true,
    });
    if (outcome.kind !== 'deleted') {
      return deleteFailureOf({
        proposal,
        error: cleanUpRefusalOf({ outcome, label: proposal.branch }),
      });
    }
    return {
      deleted: { id: outcome.deleted.id, mountId: proposal.mountId, branch: proposal.branch },
      failed: await settleOne({ sessionId, proposal }),
    };
  } catch (error) {
    return deleteFailureOf({ proposal, error });
  }
};

type AttemptParams = {
  readonly sessionId: SessionId;
  readonly pending: Pending;
};

const attemptOne = async ({ sessionId, pending }: AttemptParams): Promise<Attempt> => {
  if (pending.step === 'settle') {
    return { deleted: null, failed: await settleOne({ sessionId, proposal: pending.proposal }) };
  }
  return deleteOne({ sessionId, proposal: pending.proposal });
};

type UndoParams = {
  readonly sessionId: SessionId;
  readonly deleted: ReadonlyArray<Deleted>;
};

type AttachedParams = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

const isAttached = ({ sessionId, mountId }: AttachedParams): boolean =>
  (useAppStore.getState().sessionMounts[sessionId] ?? []).some(
    (mount) => mount.id === mountId && mount.isAttached,
  );

const offerUndo = ({ sessionId, deleted }: UndoParams): void => {
  const [first] = deleted;
  if (first === undefined) {
    return;
  }
  useAppStore.getState().undoable({
    title:
      deleted.length === 1
        ? `Deleted the local branch ${first.branch}`
        : `Deleted ${deleted.length} local branches`,
    message: 'Undo brings each branch back in a fresh folder.',
    undo: async () => {
      for (const entry of deleted) {
        await useAppStore.getState().restoreDeletedBranch({ id: entry.id });
        if (isAttached({ sessionId, mountId: entry.mountId })) {
          continue;
        }
        await useAppStore.getState().attachMount({ sessionId, mountId: entry.mountId });
      }
    },
  });
};

type RunParams = {
  readonly sessionId: SessionId;
  readonly operationKey: string;
  readonly pending: ReadonlyArray<Pending>;
  readonly onBusy?: OnBusy;
};

type ReportParams = {
  readonly sessionId: SessionId;
  readonly operationKey: string;
  readonly failed: ReadonlyArray<Failed>;
};

const reportRemaining = async ({ sessionId, operationKey, failed }: ReportParams) => {
  await useAppStore.getState().resolveNotifications([operationKey]);
  if (failed.length === 0) {
    return;
  }
  await useAppStore.getState().reportErrors({
    failures: failed.map((entry) => entry.failure),
    groupTitleOf: ({ count }) => `Couldn't delete ${count} local branches`,
    recovery: CHECK_STATE,
    sessionId,
    coalesceKey: operationKey,
    retry: () =>
      runDeletes({ sessionId, operationKey, pending: failed.map((entry) => entry.pending) }),
  });
};

const runDeletes = async ({
  sessionId,
  operationKey,
  pending,
  onBusy,
}: RunParams): Promise<boolean> => {
  const deleted: Array<Deleted> = [];
  const failed: Array<Failed> = [];
  for (const entry of pending) {
    onBusy?.({ mountId: entry.proposal.mountId, isBusy: true });
    const attempt = await attemptOne({ sessionId, pending: entry });
    onBusy?.({ mountId: entry.proposal.mountId, isBusy: false });
    if (attempt.deleted !== null) {
      deleted.push(attempt.deleted);
    }
    if (attempt.failed !== null) {
      failed.push(attempt.failed);
    }
  }
  offerUndo({ sessionId, deleted });
  void reportRemaining({ sessionId, operationKey, failed });
  return failed.length === 0;
};

export const deleteMergedBranches = ({ sessionId, proposals, onBusy }: Params): Promise<boolean> =>
  runDeletes({
    sessionId,
    operationKey: `delete-local-branches:${crypto.randomUUID()}`,
    pending: proposals.map((proposal) => ({ proposal, step: 'delete' })),
    ...(onBusy === undefined ? {} : { onBusy }),
  });
