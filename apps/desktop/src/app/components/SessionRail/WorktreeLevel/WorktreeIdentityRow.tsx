import { useEffect } from 'react';
import type { SessionId, SessionProjectMount } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { mountRequestOf } from '../../../../store/slices/project-mounts/mountRowModel';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { pullRequestStateToneOf } from '../../../../features/branch/pullRequestStateToneOf';
import { BranchSwitcher } from '../../../../features/branch/components/BranchHeader/BranchSwitcher';
import { ObjectOverflowMenu } from '../../../../features/actions/components/ObjectOverflowMenu';
import type { MountActionTarget } from '../../../../features/actions/types';
import { requestStateOf } from '../SessionLevel/requestStateOf';
import { WorktreeMenuAnchors } from './WorktreeMenuAnchors';

type Props = {
  readonly sessionId: SessionId;
  readonly mount: SessionProjectMount;
  readonly mountPath: string;
  readonly projectName: string | null;
  readonly target: MountActionTarget | null;
};

const MENU_OMIT: ReadonlyArray<string> = [
  'mount.openPullRequest',
  'mount.openDiff',
  'mount.openReview',
  'mount.rebase',
  'mount.abortRebase',
  'mount.push',
  'mount.createPullRequest',
];

export const WorktreeIdentityRow = ({
  sessionId,
  mount,
  mountPath,
  projectName,
  target,
}: Props) => {
  const hasDetectedEditors = useAppStore((state) => state.detectedEditors.length > 0);
  const loadDetectedEditors = useAppStore((state) => state.loadDetectedEditors);
  const requestState = useAppStore((state) =>
    requestStateOf({ request: mountRequestOf({ state, mountId: mount.mountId }) }),
  );
  const mark = pullRequestStateToneOf({ state: requestState });
  const StateIcon = mark.icon;
  useEffect(() => {
    if (!hasDetectedEditors) {
      void loadDetectedEditors();
    }
  }, [hasDetectedEditors, loadDetectedEditors]);
  const name = projectName ?? mount.mountName;
  const branch = mount.branch === '' ? mount.mountName : mount.branch;
  return (
    <div data-level-identity="" data-worktree-identity="" className="flex min-w-0 flex-col">
      <span className="flex h-6 min-w-0 items-center truncate px-2 text-label text-muted-foreground">
        {name}
      </span>
      <div className="flex h-7 min-w-0 items-center gap-1">
        <BranchSwitcher
          sessionId={sessionId}
          currentPath={mountPath}
          repoName={name}
          branch={branch}
          leading={
            <StateIcon
              size={ICON_SIZE.row}
              aria-hidden
              data-pr-state={requestState}
              className={cn('shrink-0', mark.iconClass)}
            />
          }
        />
        {target === null ? null : (
          <ObjectOverflowMenu
            target={target}
            label={`${name} · ${branch} actions`}
            omit={MENU_OMIT}
            hideWhenEmpty
          />
        )}
      </div>
      <WorktreeMenuAnchors sessionId={sessionId} mount={mount} />
    </div>
  );
};
