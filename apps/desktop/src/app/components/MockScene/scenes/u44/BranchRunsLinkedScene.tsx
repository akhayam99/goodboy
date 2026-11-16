import { useEffect, useState } from 'react';
import type { SessionMountView, SessionProjectMount } from '@goodboy/types';
import { ScrollFade } from '@goodboy/ui';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { SessionOverviewPane } from '../../../../../features/session/components/SessionOverviewPane';
import { useAppStore } from '../../../../../store';
import { NOW, seedActivityRunScene } from '../activityRunSeed';
import { AUTO_ROOT_ID, AUTO_SESSION, autoSceneOf } from '../u24/autoSceneSeed';

type ViewParams = {
  readonly mount: SessionProjectMount;
};

const viewOf = ({ mount }: ViewParams): SessionMountView => ({
  id: mount.mountId,
  sessionId: mount.sessionId,
  projectId: mount.projectId,
  worktreePath: mount.worktreePath,
  lastWorktreePath: mount.lastWorktreePath,
  branch: mount.branch,
  baseBranch: mount.baseBranch,
  parallelIndex: mount.parallelIndex,
  mountName: mount.mountName,
  repoSlug: `harborline/${mount.mountName}`,
  repoRoot: mount.repoRoot,
  isAttached: true,
  diskState: 'present',
  revision: mount.revision,
  createdAt: NOW,
  updatedAt: NOW,
});

const seedOneMountLead = (): void => {
  seedActivityRunScene();
  const sessionId = AUTO_SESSION.id;
  const only = (useAppStore.getState().sessionProjectMounts[sessionId] ?? []).slice(0, 1);
  const scene = autoSceneOf({ state: 'working' });
  const primary = only[0]?.mountId ?? null;
  useAppStore.setState({
    sessionProjectMounts: { [sessionId]: only },
    sessionMounts: { [sessionId]: only.map((mount) => viewOf({ mount })) },
    sessionWorktrees: { [sessionId]: only.map((mount) => mount.worktreePath) },
    sessionActiveMount: { [sessionId]: primary },
    mountGithub: {},
    mountRequests: {},
    sessionPhaseRuns: {
      [sessionId]: scene.agents.map(({ mountId: _mountId, ...agent }) => agent),
    },
    agentKindOverride: { [AUTO_ROOT_ID]: 'auto' },
    agentProviderOverride: { [AUTO_ROOT_ID]: 'anthropic' },
    agentModelOverride: { [AUTO_ROOT_ID]: 'opus-5.5' },
    agentEffortOverride: { [AUTO_ROOT_ID]: 'medium' },
    autoTreeViews: {
      [sessionId]: [
        {
          ...scene.view,
          tree: { ...scene.view.tree, primaryMountId: primary },
          delegations: scene.view.delegations.map((delegation) => ({
            ...delegation,
            target: { ...delegation.target, mountId: primary },
          })),
        },
      ],
    },
    loadAutoTrees: async () => undefined,
    sessionOpenQuestions: { [sessionId]: [] },
    sessionAnsweredQuestions: { [sessionId]: [] },
    sessionArtifacts: { [sessionId]: [] },
    sessionPlans: { [sessionId]: [] },
    sessionEvents: { [sessionId]: [] },
  });
};

export const BranchRunsLinkedScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedOneMountLead();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }
  return (
    <AutoReleaseContext.Provider value>
      <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <ScrollFade className="min-h-0 flex-1">
          <div className="px-6 py-4">
            <SessionOverviewPane session={AUTO_SESSION} />
          </div>
        </ScrollFade>
      </main>
    </AutoReleaseContext.Provider>
  );
};
