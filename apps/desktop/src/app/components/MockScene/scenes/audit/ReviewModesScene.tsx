import { useEffect, useState } from 'react';
import type {
  IsoDateTime,
  MountId,
  PrCheckRun,
  Project,
  ProjectId,
  SessionProjectMount,
} from '@goodboy/types';
import { ReviewPane } from '../../../../../features/review/components/ReviewPane';
import { useAppStore } from '../../../../../store';
import { ShellFrame, seedShellChrome } from '../shellChrome';
import { SESSION, SESSION_ID, seedResolveScene } from '../resolveSeed';
import { sceneParam } from './sceneParams';
import { useSceneClicks } from './useSceneClicks';

const NOW = '2026-09-04T14:20:00.000Z' as IsoDateTime;
const PROJECT_ID = 'mock-review-modes-project-notify-relay' as ProjectId;
const MOUNT_ID = 'mock-review-modes-mount-notify-relay' as MountId;

const PROJECT: Project = {
  id: PROJECT_ID,
  workspaceId: SESSION.workspaceId,
  name: 'notify-relay',
  rootPath: '/mock/harborline/notify-relay',
  kind: 'repo',
  baseBranch: 'main',
  overrides: {
    defaultProviderId: null,
    defaultWorkflowId: null,
    defaultBranchPrefix: null,
    parallelEnabled: null,
    defaultVerbosity: null,
    providerBindings: null,
    taskModels: null,
    roleModels: null,
    parallelAgents: null,
    providerPool: null,
    attributionFooter: null,
    replyVoice: null,
    replyStyleNote: null,
    replyTemplateFixed: null,
    replyTemplateNoChange: null,
    resolveOnGithub: null,
    resolveCommitStyle: null,
  },
  createdAt: NOW,
  updatedAt: NOW,
};

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'notify-relay',
  worktreePath: '/mock/harborline/notify-relay-webhook-retry',
  lastWorktreePath: null,
  repoRoot: '/mock/harborline/notify-relay',
  branch: 'fix/webhook-retry-backoff',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 2,
};

const CHECKS: ReadonlyArray<PrCheckRun> = [
  { name: 'typecheck', conclusion: 'success', detailsUrl: null, durationMs: 84000 },
  { name: 'unit tests', conclusion: 'failure', detailsUrl: null, durationMs: 212000 },
  { name: 'lint', conclusion: 'pending', detailsUrl: null, durationMs: null },
];

const MODE_BUTTON: Readonly<Record<string, string>> = {
  pr_details: 'PR details',
  pr_activity: 'PR activity',
  checks: 'Checks',
  write_review: 'Write review',
};

const MODE_LABEL = MODE_BUTTON[sceneParam({ key: 'mode' }) ?? 'pr_details'];
const MODE_LABELS: ReadonlyArray<string> = MODE_LABEL === undefined ? [] : [MODE_LABEL];

export const ReviewModesScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveScene({ expandedThreadId: null });
    seedShellChrome({
      session: SESSION,
      siblings: [],
      branches: { [SESSION_ID]: 'fix/webhook-retry-backoff' },
      telemetryAt: NOW,
      lens: 'review',
    });
    const github = useAppStore.getState().sessionGithub[SESSION_ID];
    useAppStore.setState({
      projects: [PROJECT],
      sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
      sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
      sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
      reviewDrafts: { [SESSION_ID]: [] },
      reviewTargets: { [SESSION_ID]: null },
      diffComments: { [SESSION_ID]: [] },
      loadReviewDrafts: async () => undefined,
      refreshSessionPr: async () => undefined,
      refreshSessionPrDetail: async () => undefined,
      sessionGithub:
        github === undefined
          ? {}
          : {
              [SESSION_ID]: {
                ...github,
                detail: github.detail === null ? null : { ...github.detail, checks: [...CHECKS] },
              },
            },
    });
    setIsReady(true);
  }, []);

  useSceneClicks({
    isReady,
    labels: MODE_LABELS,
    selector: 'button',
    match: 'prefix',
    intervalMs: 150,
  });

  if (!isReady) {
    return null;
  }

  return <ShellFrame session={SESSION} main={<ReviewPane session={SESSION} />} />;
};
