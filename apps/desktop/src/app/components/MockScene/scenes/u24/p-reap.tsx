import { useEffect, useState } from 'react';
import type {
  Agent,
  AgentId,
  MountId,
  Project,
  ProjectId,
  ProviderRunId,
  Session,
  SessionId,
  SessionProjectMount,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { ChatView } from '../../../../../features/chat/components/ChatView';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-10T09:12:00.000Z' });

const WORKSPACE_ID = 'mock-u24-reap-workspace' as WorkspaceId;
const SESSION_ID = 'mock-u24-reap-session' as SessionId;
const AGENT_ID = 'mock-u24-reap-agent' as AgentId;
const RUN_ID = 'mock-u24-reap-run' as ProviderRunId;
const PROJECT_ID = 'mock-u24-reap-project-storefront-web' as ProjectId;
const NOW = clock.iso({ at: '2026-10-10T09:12:00.000Z' });

const OVERRIDES = {
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
  afterMerge: null,
  defaultBranchTemplate: null,
};

const WORKSPACE: Workspace = {
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
};

const PROJECT: Project = {
  id: PROJECT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'storefront-web',
  rootPath: '~/code/harborline/storefront-web',
  kind: 'repo',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
};

const MOUNT: SessionProjectMount = {
  projectId: PROJECT_ID,
  mountName: 'storefront-web',
  worktreePath: '~/code/harborline/storefront-web-worktree',
  repoRoot: '~/code/harborline/storefront-web',
  branch: 'fix/statement-banner-total',
  mountId: 'mock-u24-reap-mount' as MountId,
  sessionId: SESSION_ID,
  lastWorktreePath: null,
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
};

const SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Show the corrected total in the statement banner',
  state: { kind: 'ended', endedAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
};

const AGENT: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  name: 'Banner total',
  kind: 'implementer',
  status: 'completed',
  ordinal: 1,
  lastFinishedAt: NOW,
  lastViewedAt: NOW,
};

const TRANSCRIPT = [
  {
    kind: 'user_text' as const,
    runId: RUN_ID,
    text: 'Check the banner against the corrected statement in the browser.',
    at: NOW,
  },
  {
    kind: 'assistant_text' as const,
    runId: RUN_ID,
    delta:
      'The banner now renders the corrected total. I started the dev server to look at it and the page matches the statement.',
    at: NOW,
  },
  {
    kind: 'processes_stopped' as const,
    runId: RUN_ID,
    stopped: [
      { pid: 4101, name: 'next-server', port: null },
      { pid: 4102, name: 'sh', port: null },
    ],
    at: NOW,
  },
];

const ProcessesStoppedScene = () => {
  const [isSeeded, setIsSeeded] = useState(false);

  useEffect(() => {
    useAppStore.setState({
      workspaces: [WORKSPACE],
      currentWorkspaceId: WORKSPACE_ID,
      projects: [PROJECT],
      sessions: [SESSION],
      currentSessionId: SESSION_ID,
      selectedAgentId: { [SESSION_ID]: AGENT_ID },
      sessionPhaseRuns: { [SESSION_ID]: [AGENT] },
      transcripts: { [AGENT_ID]: TRANSCRIPT },
      sessionEvents: { [SESSION_ID]: [] },
      sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
      sessionWorktrees: { [SESSION_ID]: [MOUNT.worktreePath] },
      sessionBranches: { [SESSION_ID]: MOUNT.branch },
      sessionOpenQuestions: { [SESSION_ID]: [] },
      sessionAnsweredQuestions: { [SESSION_ID]: [] },
      sessionDismissedQuestions: { [SESSION_ID]: [] },
      sessionLoading: {
        [SESSION_ID]: {
          agents: false,
          transcript: false,
          telemetry: false,
          slots: false,
          plans: false,
          summary: false,
        },
      },
      loadSessionEvents: async () => undefined,
      loadSessionOpenQuestions: async () => undefined,
      loadSessionAnsweredQuestions: async () => undefined,
      loadSessionDismissedQuestions: async () => undefined,
      loadAgentTranscript: async () => undefined,
      navigate: () => undefined,
      markAgentViewed: async () => undefined,
      refreshProviders: async () => undefined,
      ensureProjectMounted: async () => undefined,
      recordSessionEvent: async () => undefined,
    } as never);
    setIsSeeded(true);
  }, []);

  if (!isSeeded) {
    return null;
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      <ChatView session={SESSION} />
    </div>
  );
};

export const U24_P_REAP_SCENES = {
  'processes-stopped': ProcessesStoppedScene,
};
