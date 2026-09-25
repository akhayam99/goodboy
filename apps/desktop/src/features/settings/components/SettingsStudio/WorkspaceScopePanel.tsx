import { useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { Button, InlineConfirm } from '@goodboy/ui';
import { Unplug } from 'lucide-react';
import { SkillsPanel } from '../../../../features/skills/components/SkillsPanel';
import { WorkspaceProfileSection } from './WorkspaceProfileSection';
import { WorkspaceProjectsSection } from './WorkspaceProjectsSection';
import { WorkspaceDefaultsGrid } from './WorkspaceDefaultsGrid';
import { WorkspaceTitle } from './WorkspaceTitle';
import { OrphanWorktreesSection } from '../../../../features/worktree/components/OrphanWorktreesSection';
import { WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import { useAppStore } from '../../../../store';
import { useSectionAnchors } from '../../hooks/useSectionAnchors';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { SETTINGS_PANE_ENTRY } from './settingsPaneEntry';
import { PaneShell } from '../../../../shared/components/PaneShell';

type DisconnectTitleParams = {
  readonly name: string;
  readonly runningCount: number;
};

const disconnectTitle = ({ name, runningCount }: DisconnectTitleParams): string => {
  if (runningCount === 0) {
    return `Disconnect ${name}?`;
  }
  return `Disconnect ${name} and stop ${runningCount} running ${runningCount === 1 ? 'session' : 'sessions'}?`;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly initialSection?: string;
  readonly requestClose: () => void;
};

export const WorkspaceScopePanel = ({ workspaceId, initialSection, requestClose }: Props) => {
  const disconnect = useAppStore((s) => s.disconnectWorkspace);
  const workspaceName = useAppStore(
    (s) => s.workspaces.find((w) => w.id === workspaceId)?.name ?? null,
  );
  const runningCount = useAppStore((s) =>
    s.currentWorkspaceId === workspaceId
      ? s.sessions.filter((session) => session.state.kind === 'running').length
      : 0,
  );
  const reportError = useAppStore((s) => s.reportError);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const { anchor } = useSectionAnchors({ section: initialSection });

  const onDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnect(workspaceId);
      requestClose();
    } catch (err) {
      void reportError({ title: "Couldn't disconnect the workspace", error: err, workspaceId });
      setDisconnecting(false);
    }
  };

  return (
    <PaneShell
      animationClassName={SETTINGS_PANE_ENTRY}
      header={<WorkspaceTitle workspaceId={workspaceId} />}
    >
      <div className="flex flex-col gap-6">
        {workspaceName === null ? null : (
          <>
            <div id="projects" ref={anchor({ id: 'projects' })}>
              <WorkspaceProjectsSection workspaceId={workspaceId} />
            </div>

            <div id="profile" ref={anchor({ id: 'profile' })}>
              <WorkspaceProfileSection workspaceId={workspaceId} />
            </div>
          </>
        )}

        <div id="general" ref={anchor({ id: 'general' })}>
          <WorkspaceDefaultsGrid workspaceId={workspaceId} />
        </div>

        {WORKSPACE_FEATURES.skills ? (
          <div ref={anchor({ id: 'skills' })}>
            <SkillsPanel workspaceId={workspaceId} />
          </div>
        ) : null}

        <div ref={anchor({ id: 'orphans' })}>
          <OrphanWorktreesSection workspaceId={workspaceId} />
        </div>

        <section
          id="danger"
          ref={anchor({ id: 'danger' })}
          aria-label="Disconnect workspace"
          className="flex flex-col items-start gap-2"
        >
          {confirmDisconnect ? (
            <InlineConfirm
              role="danger"
              icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
              title={disconnectTitle({
                name: workspaceName ?? 'this workspace',
                runningCount,
              })}
              description="Projects, branches and worktrees stay on disk. Choose Add workspace with the same folder to bring it back with its sessions."
              confirmLabel="Disconnect"
              isBusy={disconnecting}
              onConfirm={onDisconnect}
              onCancel={() => setConfirmDisconnect(false)}
              className="self-stretch text-left"
            />
          ) : (
            <span className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDisconnect(true)}
                className="text-muted-foreground hover:text-danger"
              >
                <Unplug size={ICON_SIZE.row} aria-hidden />
                Disconnect workspace
              </Button>
              <span className="text-xs text-faint-foreground">Nothing on disk is deleted.</span>
            </span>
          )}
        </section>
      </div>
    </PaneShell>
  );
};
