import { useEffect, useState } from 'react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  MountId,
  ProjectId,
  ProviderRunId,
  Session,
  SessionId,
  TurnEvent,
  WorkspaceId,
} from '@goodboy/types';
import type { AgentPane } from '../../../../store/slices/navigation/types';
import type { ScribeWork } from '../../../../store/slices/scribe/types';
import { AgentDetailPane } from '../../../../features/session/components/AgentDetailPane';
import { useAppStore } from '../../../../store';

const WORKSPACE_ID = 'mock-scribe-workspace' as WorkspaceId;
const PROJECT_ID = 'mock-scribe-project' as ProjectId;
const SESSION_ID = 'mock-scribe-session' as SessionId;
const MOUNT_ID = 'mock-scribe-mount' as MountId;
const AGENT_ID = 'mock-scribe-agent' as AgentId;
const RUN_ID = 'mock-scribe-run' as ProviderRunId;
const SCRIBE_KEY = `pr:${MOUNT_ID}`;
const BRANCH = 'fix/ledger-postings';

const NOW = '2026-10-05T10:12:00.000Z' as IsoDateTime;

const SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Make ledger postings idempotent',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: NOW,
  updatedAt: NOW,
};

const AGENT: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'Scribe',
  status: 'completed',
  kind: 'scribe',
  runId: RUN_ID,
  outputSummary: 'got it - PR text ready, engine creates the draft. standing by.',
  startedAt: '2026-10-05T10:11:00.000Z' as IsoDateTime,
  completedAt: NOW,
};

const KICKOFF = [
  `Write the title and body of a new pull request for ${BRANCH} into main, opened as a draft.`,
  `Read \`git log main..${BRANCH}\` and \`git diff main...${BRANCH}\`. Emit one pr-title block and one pr-body block.`,
  '',
  'Session goal: Make ledger postings idempotent',
].join('\n');

const PROPOSAL = [
  '<<pr-title>>',
  'Guard settlement postings against retries',
  '<</pr-title>>',
  '<<pr-body>>',
  'Retried settlement batches no longer post twice.',
  '',
  '- key each posting by its event id',
  '- skip a batch the ledger already holds',
  '<</pr-body>>',
].join('\n');

const commands = ['git log main..HEAD', 'git diff main...HEAD --stat', 'git show HEAD', 'ls'];

const TRANSCRIPT: ReadonlyArray<TurnEvent> = [
  { kind: 'user_text', runId: RUN_ID, text: KICKOFF, at: NOW },
  ...commands.flatMap((command, index): ReadonlyArray<TurnEvent> => [
    {
      kind: 'tool_call_start',
      runId: RUN_ID,
      toolUseId: `mock-scribe-tool-${index}`,
      toolName: 'Bash',
      input: { command },
      at: NOW,
    },
    {
      kind: 'tool_call_end',
      runId: RUN_ID,
      toolUseId: `mock-scribe-tool-${index}`,
      output: 'ok',
      isError: false,
      at: NOW,
    },
  ]),
  { kind: 'assistant_text', runId: RUN_ID, delta: PROPOSAL, at: NOW },
];

export type ScribeProposalSceneState = 'creating' | 'failed';

const WORK: Readonly<Record<ScribeProposalSceneState, ScribeWork>> = {
  creating: {
    key: SCRIBE_KEY,
    sessionId: SESSION_ID,
    mountId: MOUNT_ID,
    agentId: AGENT_ID,
    task: { kind: 'pr', closedPrNumber: null, references: [], isDraft: true, base: null },
    status: 'creating',
    output: null,
    error: null,
    pullRequest: null,
    updatedAt: 0,
  },
  failed: {
    key: SCRIBE_KEY,
    sessionId: SESSION_ID,
    mountId: MOUNT_ID,
    agentId: AGENT_ID,
    task: { kind: 'pr', closedPrNumber: null, references: [], isDraft: true, base: null },
    status: 'failed',
    output: null,
    error: `Couldn't push ${BRANCH}: remote: Permission to harborline/ledger-core.git denied`,
    pullRequest: null,
    updatedAt: 0,
  },
};

type Props = {
  readonly state: ScribeProposalSceneState;
  readonly pane: AgentPane;
};

export const ScribeProposalScene = ({ state, pane }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    useAppStore.setState({
      sessions: [SESSION],
      currentSessionId: SESSION_ID,
      selectedAgentId: { [SESSION_ID]: AGENT_ID },
      agentPane: { [SESSION_ID]: pane },
      sessionPhaseRuns: { [SESSION_ID]: [AGENT] },
      agentRunHistory: { [AGENT_ID]: [RUN_ID] },
      transcripts: { [AGENT_ID]: TRANSCRIPT },
      loadAgentTranscript: async () => undefined,
      sessionPlans: { [SESSION_ID]: [] },
      sessionOpenQuestions: { [SESSION_ID]: [] },
      sessionAnsweredQuestions: { [SESSION_ID]: [] },
      sessionProjectMounts: {
        [SESSION_ID]: [
          {
            projectId: PROJECT_ID,
            mountName: 'ledger-core',
            worktreePath: '/mock/ledger-core',
            repoRoot: '/mock/ledger-core',
            branch: BRANCH,
            mountId: MOUNT_ID,
            sessionId: SESSION_ID,
            lastWorktreePath: null,
            baseBranch: 'main',
            parallelIndex: 0,
            isAttached: true,
            diskState: 'present',
            revision: 0,
          },
        ],
      },
      mountGithub: {},
      scribeAgents: { [AGENT_ID]: SCRIBE_KEY },
      scribeWork: { [SCRIBE_KEY]: WORK[state] },
    });
    setIsReady(true);
  }, [pane, state]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      <AgentDetailPane
        session={SESSION}
        agent={AGENT}
        isChatActive={false}
        onBack={() => undefined}
      />
    </main>
  );
};
