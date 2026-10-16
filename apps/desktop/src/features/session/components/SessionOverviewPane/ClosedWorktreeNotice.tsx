import { useEffect } from 'react';
import { Button, Notice } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { actionButtonStateOf } from '../../../actions/actionButtonStateOf';
import { ActionConfirmPanel } from '../../../actions/components/ActionControls/ActionConfirmPanel';
import type { ActionControls } from '../../../actions/useActionControls';

type Props = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly controls: ActionControls;
};

type BodyParams = {
  readonly isBranchGone: boolean;
  readonly isOnDisk: boolean;
};

const bodyOf = ({ isBranchGone, isOnDisk }: BodyParams): string => {
  if (isBranchGone) {
    return 'Its branch was deleted.';
  }
  return isOnDisk ? 'Its files are still on disk.' : 'Its files were removed.';
};

export const ClosedWorktreeNotice = ({ sessionId, row, controls }: Props) => {
  const isBranchGone = useAppStore((state) => state.mountBranchGone[row.mountId] !== undefined);
  const checkMountBranchGone = useAppStore((state) => state.checkMountBranchGone);
  const reportError = useAppStore((state) => state.reportError);
  const isRepo = row.projectKind === 'repo';

  useEffect(() => {
    if (!isRepo) {
      return;
    }
    checkMountBranchGone({ sessionId, mountId: row.mountId }).catch((error: unknown) => {
      void reportError({ title: "Couldn't check the branch", error, sessionId });
    });
  }, [checkMountBranchGone, isRepo, reportError, row.mountId, row.revision, sessionId]);

  const branch = row.branch === '' ? row.mountName : row.branch;
  const inline = controls
    .inSlot({ slot: 'inline' })
    .filter((action) => action.group !== 'open' && action.id !== 'mount.close');
  const remove = isBranchGone
    ? controls.actions.filter((action) => action.id === 'mount.removeGone')
    : [];
  const actions = [...inline, ...remove];

  return (
    <div data-closed-worktree={row.mountId} className="flex min-w-0 flex-col gap-2">
      <Notice
        role="status"
        placement="inline"
        tone="info"
        title={`${branch} in ${row.projectName} is closed`}
        body={bodyOf({ isBranchGone, isOnDisk: row.isOnDisk })}
        actions={
          actions.length === 0 ? undefined : (
            <>
              {actions.map((action) => {
                const state = actionButtonStateOf({
                  controls,
                  actionId: action.id,
                  label: action.shortLabel,
                  pendingLabel: action.pendingLabel,
                });
                return (
                  <Button
                    key={action.id}
                    size="sm"
                    variant="secondary"
                    disabled={action.blockedReason !== null}
                    isBusy={state.isPending}
                    aria-label={`${action.label} for ${branch}`}
                    onClick={() => controls.trigger({ actionId: action.id })}
                  >
                    {state.label}
                  </Button>
                );
              })}
            </>
          )
        }
      />
      <ActionConfirmPanel controls={controls} />
    </div>
  );
};
