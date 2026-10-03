import { useEffect, useState } from 'react';
import { Button, Notice, Skeleton } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectLiveWork } from '../../../store/slices/live-work/selectLiveWork';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { changedCount } from '../../../shared/lib/gitStatus';
import { MoveCard } from '../MoveCard';
import { MoveReport } from '../MoveReport';
import { useBootstrapWatch } from '../hooks/useBootstrapWatch';
import { useLapProject } from '../useLapProject';

type Props = {
  readonly sessionId: SessionId;
};

const resumed = new Set<string>();

export const FirstLapBanner = ({ sessionId }: Props) => {
  const { project, stage } = useLapProject({ sessionId });
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
  const probeProjectRemote = useAppStore((state) => state.probeProjectRemote);
  const resumeBootstrapMove = useAppStore((state) => state.resumeBootstrapMove);
  const navigate = useAppStore((state) => state.navigate);
  const [isRetrying, setIsRetrying] = useState(false);
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

  const isChecking = hasRemote && (probe === null || isRetrying);
  const retry = () => {
    setIsRetrying(true);
    void probeProjectRemote({ projectId: project.id }).finally(() => setIsRetrying(false));
  };

  return (
    <div className="flex flex-col gap-3 bg-subtle px-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-label text-foreground">
          {isOnRemote
            ? `${project.name} · main is on the remote now.`
            : `${project.name} · This session works in your project folder`}
        </span>
        <span className="text-secondary text-muted-foreground">
          {isOnRemote
            ? 'Move your work into bootstrap when you are ready.'
            : 'Nothing is published yet.'}
        </span>
      </div>
      {isChecking && !isOnRemote ? (
        <div role="status" aria-label="Checking the remote" className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-48" />
          <span className="text-secondary text-faint-foreground">Checking the remote</span>
        </div>
      ) : null}
      {!isChecking && probe?.kind === 'unreachable' && hasRemote ? (
        <Notice
          tone="warning"
          placement="inline"
          role="status"
          title="Couldn't check the remote"
          body="You can keep working here. Publishing needs the remote to answer."
          actions={
            <Button variant="secondary" size="sm" onClick={retry}>
              Try again
            </Button>
          }
        />
      ) : null}
      {isOnRemote ? (
        <MoveCard project={project} changedCount={changed} isTurnRunning={isTurnRunning} />
      ) : null}
      {notice !== null ? (
        <Notice tone="warning" placement="inline" role="alert" title={notice} />
      ) : null}
    </div>
  );
};
