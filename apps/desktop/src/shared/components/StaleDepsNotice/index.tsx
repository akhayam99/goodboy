import { Notice } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectMountById } from '../../../store/slices/project-mounts/selectors';
import { useWorktreeDeps } from '../../hooks/useWorktreeDeps';
import { ReinstallDepsAction } from '../ReinstallDepsAction';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly onInstalled?: () => void;
};

export const StaleDepsNotice = ({ sessionId, mountId, onInstalled }: Props) => {
  const worktreePath = useAppStore(
    (state) => selectMountById({ state, sessionId, mountId })?.worktreePath ?? null,
  );
  const { finding, recheck } = useWorktreeDeps({ worktreePath });
  if (finding === null || worktreePath === null) {
    return null;
  }
  return (
    <Notice
      tone="warning"
      placement="inline"
      role="status"
      title={finding.title}
      body={finding.body}
      actions={
        <ReinstallDepsAction
          sessionId={sessionId}
          mountId={mountId}
          worktreePath={worktreePath}
          onInstalled={() => {
            recheck();
            onInstalled?.();
          }}
        />
      }
    />
  );
};
