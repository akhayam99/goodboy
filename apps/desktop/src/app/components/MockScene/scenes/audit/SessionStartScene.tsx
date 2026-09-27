import { useEffect, useState } from 'react';
import type {
  IsoDateTime,
  Project,
  ProjectId,
  Session,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SESSION, WORKSPACE_ID, seedWorkflowScene } from '../workflowSeed';
import { WorkspaceFrame } from './WorkspaceFrame';
import { WORKSPACE_SIBLINGS, seedWorkspaceChrome } from './workspaceChrome';
import { sceneParam } from './sceneParams';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-09-27T09:00:00.000Z' });
const T0 = clock.iso({ at: '2026-09-27T08:59:00.000Z' });

const BLANK_ID = 'mock-session-start-blank' as SessionId;
const GOAL = 'Stop notify-relay from retrying settled webhooks. Then surface the stuck ones.';
const TITLE = 'Stop notify-relay from retrying settled webhooks.';

const projectOf = ({ name }: { readonly name: string }): Project => ({
  id: `mock-session-start-${name}` as ProjectId,
  workspaceId: WORKSPACE_ID,
  name,
  rootPath: `/mock/northwind/${name}`,
  kind: 'repo',
  overrides: {
    defaultProviderId: null,
    defaultBranchPrefix: null,
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
    afterMerge: null,
  },
  createdAt: T0,
  updatedAt: T0,
});

const PROJECTS: ReadonlyArray<Project> = ['payments-api', 'notify-relay', 'ledger-core'].map(
  (name) => projectOf({ name }),
);

type PresetParams = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly origin: Workflow['origin'];
  readonly steps: ReadonlyArray<string>;
};

const presetOf = ({ id, name, description, origin, steps }: PresetParams): Workflow => ({
  id: id as WorkflowId,
  workspaceId: WORKSPACE_ID,
  name,
  description,
  isPreset: true,
  origin,
  createdAt: T0 as IsoDateTime,
  updatedAt: T0 as IsoDateTime,
  steps: steps.map((stepName, ordinal) => ({
    id: `${id}-step-${ordinal}` as StepId,
    workflowId: id as WorkflowId,
    ordinal,
    name: stepName,
    role: 'custom',
    promptPrefix: stepName,
  })),
});

const PRESETS: ReadonlyArray<Workflow> = [
  presetOf({
    id: 'mock-session-start-harborline-release',
    name: 'Harborline release',
    description: 'Bump, changelog, tag and publish payments-api.',
    origin: 'custom',
    steps: ['Bump the version', 'Write the changelog', 'Tag and publish'],
  }),
  presetOf({
    id: 'mock-session-start-fix-bug',
    name: 'Fix a bug',
    description: 'Reproduce it, fix it, prove it stays fixed.',
    origin: 'library',
    steps: ['Reproduce', 'Fix', 'Add a regression test', 'Review'],
  }),
  presetOf({
    id: 'mock-session-start-ship-feature',
    name: 'Ship a feature',
    description: 'Plan, build, test and review a change end to end.',
    origin: 'library',
    steps: ['Plan', 'Implement', 'Test', 'Review', 'Open the pull request'],
  }),
];

type Variant = 'goal' | 'project' | 'work';

const variantOf = ({ value }: { readonly value: string | null }): Variant =>
  value === 'project' || value === 'work' ? value : 'goal';

const blankSession = ({ variant }: { readonly variant: Variant }): Session => ({
  ...SESSION,
  id: BLANK_ID,
  goal: variant === 'goal' ? '' : TITLE,
  state: { kind: 'draft' },
  contextSlots: [],
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  activeProjectId: undefined,
  createdAt: T0,
  updatedAt: T0,
});

const seedBlankSession = ({ variant }: { readonly variant: Variant }): void => {
  const base = useAppStore.getState();
  useAppStore.setState({
    projects: [
      ...base.projects.filter((project) => project.workspaceId !== WORKSPACE_ID),
      ...PROJECTS,
    ],
    phaseTemplates: { ...base.phaseTemplates, [WORKSPACE_ID]: PRESETS },
    loadPhaseTemplates: async () => undefined,
    loadSessionMounts: async () => [],
    loadPrSeries: async () => [],
    sessionProjectMounts: { ...base.sessionProjectMounts, [BLANK_ID]: [] },
    sessionWorktreeRecords: { ...base.sessionWorktreeRecords, [BLANK_ID]: [] },
    sessionSlots: {
      ...base.sessionSlots,
      [BLANK_ID]: variant === 'goal' ? [] : [{ key: 'goal', value: GOAL, enabled: true }],
    },
    sessionSlotsLoad: { ...base.sessionSlotsLoad, [BLANK_ID]: 'loaded' },
    sessionLoading: {
      ...base.sessionLoading,
      [BLANK_ID]: {
        agents: false,
        transcript: false,
        telemetry: false,
        slots: false,
        plans: false,
        summary: false,
      },
    },
    sessionPhaseRuns: { ...base.sessionPhaseRuns, [BLANK_ID]: [] },
    sessionPlans: { ...base.sessionPlans, [BLANK_ID]: [] },
    sessionEvents: { ...base.sessionEvents, [BLANK_ID]: [] },
    sessionArtifacts: { ...base.sessionArtifacts, [BLANK_ID]: [] },
    sessionOpenQuestions: { ...base.sessionOpenQuestions, [BLANK_ID]: [] },
    sessionAnsweredQuestions: { ...base.sessionAnsweredQuestions, [BLANK_ID]: [] },
    sessionDismissedQuestions: { ...base.sessionDismissedQuestions, [BLANK_ID]: [] },
    sessionExternalTasks: { ...base.sessionExternalTasks, [BLANK_ID]: [] },
    sessionWorkflows: { ...base.sessionWorkflows, [BLANK_ID]: [] },
    sessionSetupSkips: variant === 'work' ? { [BLANK_ID]: ['project'] } : {},
    goodboyNamedSessionId: variant === 'goal' ? null : BLANK_ID,
    blankSessionId: BLANK_ID,
  });
};

export const SessionStartScene = () => {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    seedWorkflowScene();
    const variant = variantOf({ value: sceneParam({ key: 'v' }) });
    const next = blankSession({ variant });
    seedWorkspaceChrome({ session: next, siblings: [SESSION, ...WORKSPACE_SIBLINGS] });
    seedBlankSession({ variant });
    setSession(next);
    const openBuilder = () =>
      useAppStore.setState((state) => ({
        sessionStudio: { ...state.sessionStudio, [BLANK_ID]: { kind: 'workflow' } },
      }));
    window.addEventListener('goodboy:open-workflow-builder', openBuilder);
    return () => window.removeEventListener('goodboy:open-workflow-builder', openBuilder);
  }, []);

  if (session === null) {
    return null;
  }
  return <WorkspaceFrame session={session} />;
};
