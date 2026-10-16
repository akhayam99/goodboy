import { useState } from 'react';
import { Button, Notice } from '@goodboy/ui';
import type { Project, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sessionPlace } from '../../../../../store/slices/navigation/place';
import { changedCount } from '../../../../../shared/lib/gitStatus';
import { PublishPanel } from '../../../../bootstrap/PublishPanel';
import { MountActionsMenu } from './MountActionsMenu';

type Props = {
  readonly sessionId: SessionId;
  readonly project: Project;
  readonly stage: 'first-lap' | 'moving';
};

type RemoteLineParams = {
  readonly isChecking: boolean;
  readonly isUnreachable: boolean;
};

const remoteLineOf = ({ isChecking, isUnreachable }: RemoteLineParams): string | null => {
  if (isChecking) {
    return 'Checking the remote';
  }
  if (isUnreachable) {
    return "Couldn't check the remote. Publishing needs it to answer.";
  }
  return null;
};

export const LapPublishNotice = ({ sessionId, project, stage }: Props) => {
  const probe = useAppStore((state) => state.bootstrapRemoteProbe[project.id]?.probe ?? null);
  const status = useAppStore((state) => state.projectGitStatus[project.id] ?? null);
  const probeProjectRemote = useAppStore((state) => state.probeProjectRemote);
  const moveToBootstrap = useAppStore((state) => state.moveToBootstrap);
  const navigate = useAppStore((state) => state.navigate);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (probe?.kind === 'main-present' || stage === 'moving') {
    return null;
  }

  const changed = status === null ? null : changedCount({ workingTree: status.workingTree });
  const hasRemote = project.remoteUrl !== undefined && project.remoteUrl !== '';
  const isChecking = hasRemote && (probe === null || isRetrying);
  const isUnreachable = !isChecking && hasRemote && probe?.kind === 'unreachable';
  const retry = () => {
    setIsRetrying(true);
    void probeProjectRemote({ projectId: project.id }).finally(() => setIsRetrying(false));
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Notice
        tone="info"
        placement="inline"
        role="status"
        title="Not published yet"
        body={remoteLineOf({ isChecking, isUnreachable })}
        actions={
          <>
            {isUnreachable ? (
              <Button variant="secondary" size="sm" onClick={retry}>
                Retry
              </Button>
            ) : null}
            {isPublishing ? null : (
              <Button variant="secondary" size="sm" onClick={() => setIsPublishing(true)}>
                Publish
              </Button>
            )}
            <MountActionsMenu
              sessionId={sessionId}
              projectId={project.id}
              workspaceId={project.workspaceId}
              projectName={project.name}
              worktreePath={project.rootPath}
            />
          </>
        }
      >
        {isPublishing ? (
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
        ) : null}
      </Notice>
      {notice === null ? null : (
        <Notice tone="warning" placement="inline" role="alert" title={notice} />
      )}
    </div>
  );
};
