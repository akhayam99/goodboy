import { useEffect, useState } from 'react';
import type { IsoDateTime, Session, SessionId, StepId, Workflow, WorkflowId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import {
  EMPTY_SESSION_DRAFT,
  type StartChoice,
} from '../../../../../store/slices/sessionDraft/state';
import { NewSessionBridge } from '../../../../../features/session/components/NewSessionBridge';
import { SESSION, WORKSPACE_ID, seedWorkflowScene } from '../workflowSeed';
import { WorkspaceFrame } from './WorkspaceFrame';
import { SessionStartMain } from './SessionStartMain';
import { WORKSPACE_SIBLINGS, seedWorkspaceChrome } from './workspaceChrome';
import { sceneParam } from './sceneParams';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-09-27T09:00:00.000Z' });
const T0 = clock.iso({ at: '2026-09-27T08:59:00.000Z' });

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
  presetOf({
    id: 'mock-session-start-harborline-release',
    name: 'Harborline release',
    description: 'Bump, changelog, tag and publish payments-api.',
    origin: 'custom',
    steps: ['Bump the version', 'Write the changelog', 'Tag and publish'],
  }),
];

const choiceOf = ({ value }: { readonly value: string | null }): StartChoice | null =>
  value === 'task' || value === 'workflow' || value === 'scout' ? value : null;

const blankSessionOf = ({
  id,
  goal,
}: {
  readonly id: SessionId;
  readonly goal: string;
}): Session => ({
  ...SESSION,
  id,
  goal,
  state: { kind: 'draft' },
  contextSlots: [],
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  activeProjectId: undefined,
  createdAt: new Date().toISOString() as IsoDateTime,
  updatedAt: new Date().toISOString() as IsoDateTime,
});

const createInMemory = async ({
  goal,
  title,
}: {
  readonly goal: string;
  readonly title?: string;
}): Promise<{ session: Session }> => {
  const session = blankSessionOf({
    id: `mock-session-start-${crypto.randomUUID()}` as SessionId,
    goal: (title ?? goal).trim(),
  });
  useAppStore.setState((state) => ({
    sessions: [session, ...state.sessions],
    currentSessionId: session.id,
    sessionProjectMounts: { ...state.sessionProjectMounts, [session.id]: [] },
    sessionWorktreeRecords: { ...state.sessionWorktreeRecords, [session.id]: [] },
    sessionSlots: { ...state.sessionSlots, [session.id]: [] },
    sessionSlotsLoad: { ...state.sessionSlotsLoad, [session.id]: 'loaded' },
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [session.id]: [] },
    sessionPlans: { ...state.sessionPlans, [session.id]: [] },
    sessionEvents: { ...state.sessionEvents, [session.id]: [] },
    sessionOpenQuestions: { ...state.sessionOpenQuestions, [session.id]: [] },
    sessionWorkflows: { ...state.sessionWorkflows, [session.id]: [] },
    sessionExternalTasks: { ...state.sessionExternalTasks, [session.id]: [] },
  }));
  return { session };
};

const seedStart = (): void => {
  const navigate = useAppStore.getState().navigate;
  seedWorkflowScene();
  seedWorkspaceChrome({ session: SESSION, siblings: WORKSPACE_SIBLINGS });
  const base = useAppStore.getState();
  const choice = choiceOf({ value: sceneParam({ key: 'kind' }) });
  const isOpen = sceneParam({ key: 'open' }) === '1';
  useAppStore.setState({
    navigate,
    phaseTemplates: { ...base.phaseTemplates, [WORKSPACE_ID]: PRESETS },
    loadPhaseTemplates: async () => undefined,
    loadSessionMounts: async () => [],
    loadPrSeries: async () => [],
    createSession: createInMemory as never,
    attachWorkflowToSession: async () => undefined,
    savePhaseTemplate: async () => undefined,
    generateWorkflowTitle: async () => undefined,
    spawnAgent: async () => undefined,
    workspaceIntegrations: {},
    starredIssues: {},
    sessionDrafts: { [WORKSPACE_ID]: { ...EMPTY_SESSION_DRAFT, choice } },
    ...(isOpen && { currentSessionId: null, openSessionDraftWorkspaceId: WORKSPACE_ID }),
  } as never);
};

export const SessionStartScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedStart();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }
  return (
    <>
      <NewSessionBridge />
      <WorkspaceFrame session={SESSION} main={<SessionStartMain />} />
    </>
  );
};
