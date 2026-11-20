import type { MountCleanupProposal, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import type { ActionFailure } from '../../../../store/slices/notifications/reportErrors';
import { cleanUpRefusalOf } from '../../../actions/kinds/cleanUpRefusalOf';
import { mergedMountsOf } from '../../../actions/kinds/mergedMountsOf';

type Params = {
  readonly sessionId: SessionId;
  readonly proposals: ReadonlyArray<MountCleanupProposal>;
  readonly onBusy?: (params: BusyParams) => void;
};

type BusyParams = {
  readonly mountId: MountId;
  readonly isBusy: boolean;
};

type Deleted = {
  readonly id: string;
  readonly mountId: MountId;
  readonly branch: string;
};

type TitleParams = {
  readonly branch: string;
};

const branchDeleteTitleOf = ({ branch }: TitleParams): string =>
  `Couldn't delete the local branch ${branch}`;

type DeleteOneParams = {
  readonly sessionId: SessionId;
  readonly proposal: MountCleanupProposal;
};

type DeleteOneResult =
  | { readonly isDeleted: true; readonly deleted: Deleted }
  | { readonly isDeleted: false; readonly failure: ActionFailure };

const deleteOne = async ({ sessionId, proposal }: DeleteOneParams): Promise<DeleteOneResult> => {
  const state = useAppStore.getState();
  const merged = mergedMountsOf({ state, sessionId }).find(
    (mount) => mount.mountId === proposal.mountId,
  );
  const title = branchDeleteTitleOf({ branch: proposal.branch });
  try {
    const outcome = await state.runAfterMergeCleanup({
      sessionId,
      mountId: proposal.mountId,
      expectedBranch: proposal.branch,
      mergedHeadSha: merged?.mergedHeadSha ?? null,
      isRequested: true,
    });
    if (outcome.kind !== 'deleted') {
      return {
        isDeleted: false,
        failure: { title, error: cleanUpRefusalOf({ outcome, label: proposal.branch }) },
      };
    }
    await useAppStore
      .getState()
      .settleMountCleanup({ sessionId, mountId: proposal.mountId, outcome: 'removed' });
    return {
      isDeleted: true,
      deleted: { id: outcome.deleted.id, mountId: proposal.mountId, branch: proposal.branch },
    };
  } catch (error) {
    return { isDeleted: false, failure: { title, error } };
  }
};

type UndoParams = {
  readonly sessionId: SessionId;
  readonly deleted: ReadonlyArray<Deleted>;
};

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
        await useAppStore.getState().attachMount({ sessionId, mountId: entry.mountId });
      }
    },
  });
};

export const deleteMergedBranches = async ({
  sessionId,
  proposals,
  onBusy,
}: Params): Promise<boolean> => {
  const deleted: Array<Deleted> = [];
  const failed: Array<{
    readonly proposal: MountCleanupProposal;
    readonly failure: ActionFailure;
  }> = [];
  for (const proposal of proposals) {
    onBusy?.({ mountId: proposal.mountId, isBusy: true });
    const result = await deleteOne({ sessionId, proposal });
    onBusy?.({ mountId: proposal.mountId, isBusy: false });
    if (result.isDeleted) {
      deleted.push(result.deleted);
      continue;
    }
    failed.push({ proposal, failure: result.failure });
  }
  offerUndo({ sessionId, deleted });
  if (failed.length > 0) {
    void useAppStore.getState().reportErrors({
      failures: failed.map((entry) => entry.failure),
      groupTitleOf: ({ count }) => `Couldn't delete ${count} local branches`,
      recovery: CHECK_STATE,
      sessionId,
      retry: () =>
        deleteMergedBranches({ sessionId, proposals: failed.map((entry) => entry.proposal) }),
    });
  }
  return failed.length === 0;
};
