import {
  DEFAULT_WORKFLOW_RULES,
  brandId,
  type Agent,
  type AgentId,
  type GoalAttachment,
  type OrchestratorHint,
  type Session,
  type SessionId,
  type Step,
  type StepId,
  type Workflow,
  type WorkflowId,
  type WorkflowRun,
  type WorkflowRunId,
  type Workspace,
  type WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-30T15:12:00.000Z' });

type AtParams = {
  readonly minute: string;
};

const at = ({ minute }: AtParams) => clock.iso({ at: `2026-10-30T15:${minute}.000Z` });

export const HINT_NODE_WORKSPACE_ID = brandId<WorkspaceId>({ value: 'mock-u32-hn-workspace' });
export const HINT_NODE_SESSION_ID = brandId<SessionId>({ value: 'mock-u32-hn-session' });
export const HINT_NODE_RUN_ID = brandId<WorkflowRunId>({ value: 'mock-u32-hn-run' });
export const HINT_NODE_WORKING_DIR = '/mock/harborline/payments-api';
export const HINT_NODE_READ_TEXT =
  'The retry storm comes from notify-relay, not payments-api.\nCheck the webhook timeout before you touch the ledger.';
export const HINT_NODE_QUEUED_TEXT = 'Also cover the refund webhook.';

const WORKFLOW_ID = brandId<WorkflowId>({ value: 'mock-u32-hn-workflow' });
const STEP_IDS = ['scout', 'fix', 'verify'].map((key) =>
  brandId<StepId>({ value: `mock-u32-hn-step-${key}` }),
);
const AGENT_IDS = ['scout', 'fix', 'verify'].map((key) =>
  brandId<AgentId>({ value: `mock-u32-hn-agent-${key}` }),
);
export const HINT_NODE_THIRD_AGENT_ID = AGENT_IDS[2]!;
const NOW = at({ minute: '12:00' });

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
  id: HINT_NODE_WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
};

type StepParams = {
  readonly index: number;
  readonly name: string;
  readonly role: Step['role'];
};

const stepOf = ({ index, name, role }: StepParams): Step => ({
  id: STEP_IDS[index]!,
  workflowId: WORKFLOW_ID,
  ordinal: index,
  name,
  role,
  promptPrefix: '',
  orchestratorReason: '',
});

const STEPS: ReadonlyArray<Step> = [
  stepOf({ index: 0, name: 'Find where checkout retries', role: 'scout' }),
  stepOf({ index: 1, name: 'Cap the webhook retries', role: 'implementer' }),
  stepOf({ index: 2, name: 'Prove the retries stop', role: 'tester' }),
];

export const HINT_NODE_WORKFLOW: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: HINT_NODE_WORKSPACE_ID,
  name: 'Stop the checkout retry storm',
  description: '',
  origin: 'orchestrated',
  processText: '',
  steps: STEPS,
  createdAt: at({ minute: '00:00' }),
  updatedAt: at({ minute: '00:00' }),
};

const SHOTS = [
  { id: 'mock-u32-hn-image-502', fileName: 'checkout-502.png', hue: 8, caption: 'Checkout 502' },
  { id: 'mock-u32-hn-image-relay', fileName: 'relay-log.png', hue: 210, caption: 'Relay log' },
];

const ATTACHMENTS: ReadonlyArray<GoalAttachment> = SHOTS.map(({ id, fileName }) => ({
  id,
  ownerType: 'workflow_run',
  ownerId: HINT_NODE_RUN_ID,
  relPath: `.goodboy/attachments/${id}-${fileName}`,
  kind: 'image',
  fileName,
  mimeType: 'image/png',
  createdAt: at({ minute: '10:30' }),
}));

const READ_HINT: OrchestratorHint = {
  id: 'mock-u32-hn-hint-relay',
  text: HINT_NODE_READ_TEXT,
  createdAt: at({ minute: '10:30' }),
  consumedAt: at({ minute: '10:50' }),
  consumedAtStep: 3,
  attachmentIds: SHOTS.map(({ id }) => id),
};

const QUEUED_HINT: OrchestratorHint = {
  id: 'mock-u32-hn-hint-refund',
  text: HINT_NODE_QUEUED_TEXT,
  createdAt: at({ minute: '11:40' }),
};

export const HINT_NODE_RUN: WorkflowRun = {
  id: HINT_NODE_RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 1,
  currentStep: 2,
  autoRun: true,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
  title: 'Stop the checkout retry storm',
  goal: 'Checkout retries hammer payments-api after a webhook timeout. Cap the retries without losing a payment.',
  createdAt: at({ minute: '01:00' }),
  providerPool: ['anthropic'],
  rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan' },
  orchestratorHints: [READ_HINT, QUEUED_HINT],
};

type AgentParams = {
  readonly index: number;
  readonly status: Agent['status'];
  readonly startedMinute: string;
  readonly completedMinute?: string;
};

const agentOf = ({ index, status, startedMinute, completedMinute }: AgentParams): Agent => ({
  id: AGENT_IDS[index]!,
  sessionId: HINT_NODE_SESSION_ID,
  workflowRunId: HINT_NODE_RUN_ID,
  stepId: STEP_IDS[index]!,
  ordinal: index,
  name: STEPS[index]!.name,
  kind: STEPS[index]!.role,
  status,
  providerOverride: 'anthropic',
  modelOverride: 'claude-sonnet-5-5',
  effort: 'high',
  startedAt: at({ minute: startedMinute }),
  ...(completedMinute === undefined ? {} : { completedAt: at({ minute: completedMinute }) }),
});

const AGENTS: ReadonlyArray<Agent> = [
  agentOf({ index: 0, status: 'completed', startedMinute: '01:00', completedMinute: '03:20' }),
  agentOf({ index: 1, status: 'completed', startedMinute: '03:40', completedMinute: '09:10' }),
  agentOf({ index: 2, status: 'running', startedMinute: '10:50' }),
];

export const HINT_NODE_SESSION: Session = {
  id: HINT_NODE_SESSION_ID,
  workspaceId: HINT_NODE_WORKSPACE_ID,
  goal: 'Checkout retry storm',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [HINT_NODE_RUN],
  autoRun: false,
  titleUserEdited: true,
  createdAt: at({ minute: '00:00' }),
  updatedAt: NOW,
};

type SvgParams = {
  readonly hue: number;
  readonly caption: string;
};

const svgOf = ({ hue, caption }: SvgParams): string =>
  [
    '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300">',
    `<rect width="480" height="300" fill="hsl(${hue} 32% 94%)"/>`,
    `<rect x="24" y="24" width="432" height="36" rx="8" fill="hsl(${hue} 45% 68%)"/>`,
    `<rect x="24" y="84" width="300" height="14" rx="6" fill="hsl(${hue} 30% 78%)"/>`,
    `<rect x="24" y="112" width="380" height="14" rx="6" fill="hsl(${hue} 30% 82%)"/>`,
    `<text x="24" y="276" font-family="sans-serif" font-size="18" fill="hsl(${hue} 40% 30%)">${caption}</text>`,
    '</svg>',
  ].join('');

type RelPathParams = {
  readonly relPath: string;
};

export const hintImageDataUriOf = ({ relPath }: RelPathParams): string | null => {
  const shot = SHOTS.find(({ fileName }) => relPath.endsWith(fileName));
  if (shot === undefined) {
    return null;
  }
  return `data:image/svg+xml,${encodeURIComponent(svgOf(shot))}`;
};

type PayloadParams = {
  readonly payload: unknown;
};

export const hintImageRelPathOf = ({ payload }: PayloadParams): string | null => {
  if (typeof payload !== 'object' || payload === null || !('relPath' in payload)) {
    return null;
  }
  return typeof payload.relPath === 'string' ? payload.relPath : null;
};

export const seedHintNode = (): Session => {
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: HINT_NODE_WORKSPACE_ID,
    sessions: [HINT_NODE_SESSION],
    currentSessionId: HINT_NODE_SESSION_ID,
    sessionWorkflows: { [HINT_NODE_SESSION_ID]: [HINT_NODE_WORKFLOW] },
    sessionPhaseRuns: { [HINT_NODE_SESSION_ID]: AGENTS },
    sessionTelemetry: { [HINT_NODE_SESSION_ID]: [] },
    sessionWorktrees: { [HINT_NODE_SESSION_ID]: [HINT_NODE_WORKING_DIR] },
    workflowRunAttachments: { [HINT_NODE_RUN_ID]: ATTACHMENTS },
    orchestratingWorkflowRuns: { [HINT_NODE_RUN_ID]: false },
    orchestratorReadingHints: { [HINT_NODE_RUN_ID]: [] },
    transcripts: {},
    messages: { [HINT_NODE_SESSION_ID]: [] },
    loadAgentTranscript: async () => undefined,
    loadSessionTelemetry: async () => undefined,
    loadGoalAttachments: async () => undefined,
    sessionPlans: { [HINT_NODE_SESSION_ID]: [] },
    sessionOpenQuestions: { [HINT_NODE_SESSION_ID]: [] },
    sessionAnsweredQuestions: { [HINT_NODE_SESSION_ID]: [] },
    drawer: null,
  });
  return HINT_NODE_SESSION;
};
