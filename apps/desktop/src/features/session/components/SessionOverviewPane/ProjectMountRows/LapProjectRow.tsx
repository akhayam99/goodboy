import { useState } from 'react';
import { Band, Button, Chip, Notice } from '@goodboy/ui';
import type { Project, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sessionPlace } from '../../../../../store/slices/navigation/place';
import { changedCount } from '../../../../../shared/lib/gitStatus';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { PublishPanel } from '../../../../bootstrap/PublishPanel';
import { MountActionsMenu } from './MountActionsMenu';
import { MOUNT_CHILD_PAD, MOUNT_ROW_HEIGHT, MOUNT_ROW_PAD } from './mountGrid';

type Props = {
  readonly sessionId: SessionId;
  readonly project: Project;
  readonly stage: 'first-lap' | 'moving';
};

export const LapProjectRow = ({ sessionId, project, stage }: Props) => {
  const isOnRemote = useAppStore(
    (state) => state.bootstrapRemoteProbe[project.id]?.probe.kind === 'main-present',
  );
  const status = useAppStore((state) => state.projectGitStatus[project.id] ?? null);
  const moveToBootstrap = useAppStore((state) => state.moveToBootstrap);
  const navigate = useAppStore((state) => state.navigate);
  const [isPublishing, setIsPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const changed = status === null ? null : changedCount({ workingTree: status.workingTree });
  const branch = status?.branch ?? 'main';
  const isPublished = isOnRemote || stage === 'moving';

  return (
    <Band className="gap-0.5">
      <div
        data-slot="mount-header"
        style={{
          height: MOUNT_ROW_HEIGHT,
          paddingLeft: MOUNT_ROW_PAD,
          paddingRight: MOUNT_ROW_PAD,
        }}
        className="flex min-w-0 items-center gap-2"
      >
        <CONCEPT_ICONS.projectFolder
          size={ICON_SIZE.control}
          aria-hidden
          className="shrink-0 text-muted-foreground"
        />
        <span className="truncate text-row text-foreground">{project.name}</span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <MountActionsMenu
            sessionId={sessionId}
            projectId={project.id}
            workspaceId={project.workspaceId}
            projectName={project.name}
            worktreePath={project.rootPath}
          />
        </div>
      </div>
      <div
        role="group"
        aria-label={`${project.name} project folder`}
        data-slot="mount-child"
        style={{ paddingLeft: MOUNT_CHILD_PAD, paddingRight: MOUNT_ROW_PAD }}
        className="flex min-h-9 min-w-0 items-center gap-2 rounded-md py-1 hover:bg-hover"
      >
        <CONCEPT_ICONS.projectFolder
          size={ICON_SIZE.row}
          aria-hidden
          className="shrink-0 text-muted-foreground"
        />
        <span className="shrink-0 text-label text-foreground">Project folder</span>
        <Chip
          tone="neutral"
          shape="badge"
          kind="reference"
          icon={<CONCEPT_ICONS.branch size={ICON_SIZE.mark} aria-hidden />}
          label={<span className="font-mono">{branch}</span>}
        />
        <span className="shrink-0 text-meta text-muted-foreground">
          {isPublished ? 'on the remote' : 'not published'}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {isPublished || isPublishing ? null : (
            <Button size="sm" onClick={() => setIsPublishing(true)}>
              Publish
            </Button>
          )}
        </div>
      </div>
      {isPublishing && !isPublished ? (
        <div style={{ paddingLeft: MOUNT_CHILD_PAD, paddingRight: MOUNT_ROW_PAD }}>
          <PublishPanel
            project={project}
            primaryLabel={changed !== null && changed > 0 ? 'Publish and move my work' : 'Publish'}
            onPublished={(result) => {
              setIsPublishing(false);
              if (result.kind !== 'published') {
                return;
              }
              void moveToBootstrap({ projectId: project.id }).then((moved) => {
                if (moved.kind === 'moved') {
                  navigate({ to: sessionPlace({ sessionId: moved.session.id }) });
                  return;
                }
                if (moved.kind === 'refused') {
                  setNotice(moved.message);
                }
              });
            }}
            onCancel={() => setIsPublishing(false)}
          />
        </div>
      ) : null}
      {notice === null ? null : (
        <Notice tone="warning" placement="inline" role="alert" title={notice} />
      )}
    </Band>
  );
};
