import type { AutoTreeView } from '../../store/slices/auto-view/state';

type Params = {
  readonly view: AutoTreeView;
};

export const isAutoPlanAwaitingApproval = ({ view }: Params): boolean =>
  view.artifacts.some(
    (row) =>
      row.artifact.approvalState === 'needs_approval' &&
      row.artifact.openReviseDelegationId === null,
  );
