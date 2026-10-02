import { useEffect, useState } from 'react';
import { Button, Notice } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectLapProject } from '../../../store/slices/bootstrap/firstLap';
import { selectLiveWork } from '../../../store/slices/live-work/selectLiveWork';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { changedCount } from '../../../shared/lib/gitStatus';
import { MoveCard } from '../MoveCard';
import { MoveReport } from '../MoveReport';
import { PublishPanel } from '../PublishPanel';
import { useBootstrapWatch } from '../hooks/useBootstrapWatch';

type Props = {
  readonly sessionId: SessionId;
};

const resumed = new Set<string>();

export const FirstLapBanner = ({ sessionId }: Props) => {
  const project = useAppStore((state) => selectLapProject({ state, sessionId })?.project ?? null);
  const stage = useAppStore((state) => selectLapProject({ state, sessionId })?.stage ?? null);
  const probe = useAppStore((state) =>
    project === null ? null : (state.bootstrapRemoteProbe[project.id]?.probe ?? null),
  );
  const status = useAppStore((state) =>
    project === null ? null : (state.projectGitStatus[project.id] ?? null),
  );
  const isTurnRunning = useAppStore((state) =>
    project === null ? false : selectLiveWork({ state }).liveSessionIds.includes(sessionId),
  );
  const loadProjectGitStatus = useAppStore((state) => state.loadProjectGitStatus);
  const moveToBootstrap = useAppStore((state) => state.moveToBootstrap);
  const resumeBootstrapMove = useAppStore((state) => state.resumeBootstrapMove);
  const navigate = useAppStore((state) => state.navigate);
  const [isPublishing, setIsPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useBootstrapWatch({ projectId: project?.id ?? null, enabled: stage === 'first-lap' });

  const projectId = project?.id ?? null;
  const isOnRemote = probe?.kind === 'main-present';
  const changed = status === null ? null : changedCount({ workingTree: status.workingTree });

  useEffect(() => {
    if (projectId !== null) {
      void loadProjectGitStatus({ projectId });
    }
  }, [projectId, isOnRemote, loadProjectGitStatus]);

  useEffect(() => {
    if (projectId === null || stage !== 'moving' || resumed.has(projectId)) {
      return;
    }
    resumed.add(projectId);
    void resumeBootstrapMove({ projectId })
      .then((result) => {
        if (result.kind === 'moved') {
          navigate({ to: sessionPlace({ sessionId: result.session.id }) });
          return;
        }
        if (result.kind === 'refused') {
          setNotice(result.message);
        }
      })
      .finally(() => resumed.delete(projectId));
  }, [projectId, stage, resumeBootstrapMove, navigate]);

  if (project === null) {
    return <MoveReport sessionId={sessionId} />;
  }
  const hasRemote = project.remoteUrl !== undefined && project.remoteUrl !== '';

  if (stage === 'moving') {
    return (
      <div className="flex flex-col gap-2 bg-subtle px-4 py-3">
        <span className="text-label text-foreground">Moving your work into bootstrap</span>
        <span className="text-secondary text-muted-foreground">
          The project folder stays as it is until the copy is checked.
        </span>
        {notice !== null ? (
          <Notice tone="warning" placement="inline" role="alert" title={notice} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 bg-subtle px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-label text-foreground">{project.name} · project folder · main</span>
          <span className="text-secondary text-muted-foreground">
            {isOnRemote
              ? 'main is on the remote now.'
              : 'This session works in your project folder. Nothing is published yet.'}
          </span>
        </div>
        {isOnRemote || isPublishing ? null : (
          <Button size="sm" onClick={() => setIsPublishing(true)}>
            Publish
          </Button>
        )}
      </div>
      {probe?.kind === 'unreachable' && hasRemote ? (
        <p role="status" className="text-secondary text-warning">
          Couldn&apos;t check the remote
        </p>
      ) : null}
      {isOnRemote ? (
        <MoveCard project={project} changedCount={changed} isTurnRunning={isTurnRunning} />
      ) : null}
      {isPublishing && !isOnRemote ? (
        <PublishPanel
          project={project}
          primaryLabel={changed !== null && changed > 0 ? 'Publish and move my work' : 'Publish'}
          onPublished={(result) => {
            setIsPublishing(false);
            if (result.kind === 'published' && changed !== null && changed > 0) {
              void moveToBootstrap({ projectId: project.id }).then((moved) => {
                if (moved.kind === 'moved') {
                  navigate({ to: sessionPlace({ sessionId: moved.session.id }) });
                  return;
                }
                if (moved.kind === 'refused') {
                  setNotice(moved.message);
                }
              });
            }
          }}
          onCancel={() => setIsPublishing(false)}
        />
      ) : null}
      {notice !== null ? (
        <Notice tone="warning" placement="inline" role="alert" title={notice} />
      ) : null}
    </div>
  );
};
