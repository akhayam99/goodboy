import { useEffect, useState } from 'react';
import type { BootstrapPhase, Project, WorkspaceGitStatus } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { PublishPanel } from '../../../../../features/bootstrap/PublishPanel';
import { NOW, SESSION, seedWorkflowScene } from '../workflowSeed';
import { WorkspaceFrame } from './WorkspaceFrame';

type FirstLapState = 'lap' | 'publish' | 'move' | 'moving' | 'report';

const phaseFor = ({ state }: { readonly state: FirstLapState }): BootstrapPhase => ({
  stage: state === 'report' ? 'done' : state === 'moving' ? 'moving' : 'first-lap',
  firstLapSessionId: SESSION.id,
  bootstrapSessionId: state === 'report' ? SESSION.id : null,
  snapshotId: state === 'moving' ? 'a'.repeat(40) : null,
  worktreePath: state === 'moving' ? '/mock/cascadia/.goodboy/worktrees/bootstrap' : null,
  branch: state === 'moving' ? 'goodboy/bootstrap' : null,
  updatedAt: NOW,
});

const dirtyStatus: WorkspaceGitStatus = {
  state: 'ready',
  branch: 'main',
  headSubject: 'chore: track this project with git',
  upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
  workingTree: { kind: 'known', staged: 0, unstaged: 3, untracked: 35, unmerged: 0, changed: 38 },
  upstream: null,
  inProgress: null,
};

type SceneProps = {
  readonly state: FirstLapState;
};

const FirstLapFrame = ({ state }: SceneProps) => {
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    seedWorkflowScene();
    const seeded = useAppStore.getState().projects[0];
    if (seeded === undefined) {
      return;
    }
    const lapProject: Project = { ...seeded, name: 'cascadia', kind: 'repo' };
    const isOnRemote = state === 'move' || state === 'moving' || state === 'report';
    useAppStore.setState({
      projects: [lapProject],
      sessionProjectMounts: { [SESSION.id]: [] },
      bootstrapPhase: { [lapProject.id]: phaseFor({ state }) },
      bootstrapRemoteProbe: isOnRemote
        ? {
            [lapProject.id]: {
              probe: { kind: 'main-present', branch: 'main', sha: 'abc1234' },
              readAt: NOW,
            },
          }
        : {},
      bootstrapMoveReport:
        state === 'report'
          ? {
              [lapProject.id]: {
                projectId: lapProject.id,
                bootstrapSessionId: SESSION.id,
                movedCount: 38,
                kept: [],
                largeFiles: ['trailer.mp4'],
                ignoredAtRisk: ['.env'],
                aligned: { kind: 'already-aligned' },
              },
            }
          : {},
      projectGitStatus: { [lapProject.id]: dirtyStatus },
      probeProjectRemote: async () => ({ kind: 'reachable-no-main' }),
      resumeBootstrapMove: async () => ({
        kind: 'refused',
        reason: 'failed',
        message: 'Resuming needs the app.',
      }),
    });
    setProject(lapProject);
  }, [state]);

  if (project === null) {
    return null;
  }
  return (
    <WorkspaceFrame
      session={SESSION}
      main={
        state === 'publish' ? (
          <div className="mx-auto flex h-full w-full max-w-xl flex-col justify-center px-6">
            <PublishPanel
              project={project}
              primaryLabel="Publish and move my work"
              onPublished={() => undefined}
              onCancel={() => undefined}
            />
          </div>
        ) : undefined
      }
    />
  );
};

export const FirstLapScene = () => <FirstLapFrame state="lap" />;
export const FirstLapPublishScene = () => <FirstLapFrame state="publish" />;
export const FirstLapMoveScene = () => <FirstLapFrame state="move" />;
export const FirstLapMovingScene = () => <FirstLapFrame state="moving" />;
export const FirstLapReportScene = () => <FirstLapFrame state="report" />;
