import { useEffect, useState } from 'react';
import type {
  IsoDateTime,
  MountId,
  OverrideSettings,
  Project,
  ProjectId,
  Session,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SESSION, WORKSPACE_ID, seedWorkflowScene } from '../workflowSeed';
import { WorkspaceFrame } from './WorkspaceFrame';
import { WORKSPACE_SIBLINGS, seedWorkspaceChrome } from './workspaceChrome';
import { sceneParam } from './sceneParams';

const FRESH_ID = 'mock-states-fresh-session' as SessionId;
const T0 = '2026-08-25T17:59:00.000Z' as IsoDateTime;

const LONG_TITLE =
  'Stop notify-relay from retrying settlement webhooks forever when payments-api returns a 409 for an already-settled invoice, and surface the stuck deliveries in the Harborline web-console';

const PROJECT_NAMES = [
  'payments-api',
  'notify-relay',
  'ledger-core',
  'billing-api',
  'billing-api-settlement-exports-and-reconciliation-reports',
  'web-console',
];

const LONG_BRANCH = 'nw/fix-billing-api-settlement-exports-stuck-deliveries-surface-and-retry';

const OVERRIDES: OverrideSettings = {
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
};

const MANY_PROJECTS: ReadonlyArray<Project> = PROJECT_NAMES.map((name) => ({
  id: `mock-states-project-${name}` as ProjectId,
  workspaceId: WORKSPACE_ID,
  name,
  rootPath: `/mock/northwind/${name}`,
  kind: 'repo',
  overrides: OVERRIDES,
  createdAt: T0,
  updatedAt: T0,
}));

const MANY_MOUNTS: ReadonlyArray<SessionProjectMount> = PROJECT_NAMES.map((name, index) => ({
  projectId: `mock-states-project-${name}` as ProjectId,
  mountName: name,
  worktreePath: `/mock/northwind/sessions/${name}-wt`,
  repoRoot: `/mock/northwind/${name}`,
  branch: index === 4 ? LONG_BRANCH : `nw/fix-settlement-retry-${name}`,
  mountId: `mock-states-mount-${name}` as MountId,
  sessionId: FRESH_ID,
  lastWorktreePath: null,
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
}));

type SessionParams = {
  readonly goal: string;
};

const freshSession = ({ goal }: SessionParams): Session => ({
  ...SESSION,
  id: FRESH_ID,
  goal,
  state: { kind: 'idle', lastActivityAt: T0 },
  contextSlots: [],
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  activeProjectId: undefined,
  createdAt: T0,
  updatedAt: T0,
});

type SeedParams = {
  readonly state: string;
};

const seedFreshSession = ({ state }: SeedParams): void => {
  const base = useAppStore.getState();
  const hasMounts = state === 'many' || state === 'long';
  const otherPhaseRuns = Object.fromEntries(
    Object.entries(base.sessionPhaseRuns).filter(([key]) => key !== FRESH_ID),
  );
  useAppStore.setState({
    projects: hasMounts ? [...base.projects, ...MANY_PROJECTS] : base.projects,
    sessionProjectMounts: {
      ...base.sessionProjectMounts,
      [FRESH_ID]: state === 'many' ? MANY_MOUNTS : [],
    },
    sessionWorktreeRecords: { ...base.sessionWorktreeRecords, [FRESH_ID]: [] },
    sessionSlots: { ...base.sessionSlots, [FRESH_ID]: [] },
    sessionSlotsLoad: { ...base.sessionSlotsLoad, [FRESH_ID]: 'loaded' },
    sessionLoading: {
      ...base.sessionLoading,
      [FRESH_ID]: {
        agents: state === 'loading',
        transcript: false,
        telemetry: false,
        slots: false,
        plans: false,
        summary: false,
      },
    },
    sessionPhaseRuns: state === 'loading' ? otherPhaseRuns : { ...otherPhaseRuns, [FRESH_ID]: [] },
    sessionPlans: { ...base.sessionPlans, [FRESH_ID]: [] },
    sessionEvents: { ...base.sessionEvents, [FRESH_ID]: [] },
    sessionArtifacts: { ...base.sessionArtifacts, [FRESH_ID]: [] },
    sessionOpenQuestions: { ...base.sessionOpenQuestions, [FRESH_ID]: [] },
    sessionAnsweredQuestions: { ...base.sessionAnsweredQuestions, [FRESH_ID]: [] },
    sessionDismissedQuestions: { ...base.sessionDismissedQuestions, [FRESH_ID]: [] },
    sessionExternalTasks: { ...base.sessionExternalTasks, [FRESH_ID]: [] },
    sessionWorkflows: { ...base.sessionWorkflows, [FRESH_ID]: [] },
  });
};

export const SessionStatesScene = () => {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    seedWorkflowScene();
    const state = sceneParam({ key: 'state' }) ?? 'fresh';
    const goal = state === 'long' || state === 'many' ? LONG_TITLE : 'Untitled session';
    const next = freshSession({ goal });
    seedWorkspaceChrome({ session: next, siblings: [SESSION, ...WORKSPACE_SIBLINGS] });
    seedFreshSession({ state });
    setSession(next);
  }, []);

  if (session === null) {
    return null;
  }
  return <WorkspaceFrame session={session} />;
};
