import { useEffect, useState } from 'react';
import { Notice } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectLiveWork } from '../../../store/runtime/live-work/selectLiveWork';
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
  const resumeBootstrapMove = useAppStore((state) => state.resumeBootstrapMove);
  const navigate = useAppStore((state) => state.navigate);
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

  if (stage === 'moving') {
    return (
      <Notice
        tone="info"
        placement="inline"
        role="status"
        className="bg-transparent"
        title="Moving your work into bootstrap"
        body="The folder stays as it is until the copy is checked."
      >
        {notice !== null ? (
          <Notice tone="warning" placement="inline" role="alert" title={notice} />
        ) : null}
      </Notice>
    );
  }

  if (!isOnRemote && notice === null) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {isOnRemote ? (
        <MoveCard project={project} changedCount={changed} isTurnRunning={isTurnRunning} />
      ) : null}
      {notice !== null ? (
        <Notice tone="warning" placement="inline" role="alert" title={notice} />
      ) : null}
    </div>
  );
};
