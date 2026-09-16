import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  ArtifactId,
  IsoDateTime,
  PlanArtifact,
  ProviderRunId,
  Session,
  SessionId,
  TurnEvent,
  WorkspaceId,
} from '@goodboy/types';
import { REDACTED } from '../../shared/utils/redactSecrets';
import { buildWireframeContext } from './buildWireframeContext';
import type { DesignProfile } from './collectDesignProfile';

const NOW = '2026-09-16T10:00:00.000Z' as IsoDateTime;
const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;

const sessionWith = ({ goal }: { readonly goal: string }): Session => ({
  id: SESSION_ID,
  workspaceId: 'ws-1' as WorkspaceId,
  goal,
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
});

const agentWith = ({ name }: { readonly name: string }): Agent => ({
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name,
  status: 'completed',
});

const planWith = ({ title }: { readonly title: string }): PlanArtifact => ({
  id: 'artifact-1' as ArtifactId,
  sessionId: SESSION_ID,
  agentId: AGENT_ID,
  workflowRunId: null,
  kind: 'plan',
  schemaVersion: 1,
  title,
  sourceFormat: 'markdown',
  sourceText: 'step one',
  metadata: {},
  status: 'active',
  revision: 1,
  sourceTurnId: null,
  createdAt: NOW,
  updatedAt: NOW,
});

const transcripts: Readonly<Record<string, ReadonlyArray<TurnEvent>>> = {
  [AGENT_ID]: [
    {
      kind: 'assistant_text',
      runId: 'run-1' as ProviderRunId,
      delta: 'the inbox lists sessions',
      at: NOW,
    },
  ],
};

const profileWith = (): DesignProfile => ({
  themeName: 'goodboy',
  commitSha: 'abc1234',
  tailwind: {
    path: 'tailwind.config.ts',
    excerpt: 'export default { apiKey: "sk-live-abcdefghijklmnop" };',
  },
  tokens: [{ name: 'accent', value: '#3355ff', path: 'src/styles.css' }],
  variants: [
    { path: 'src/components/Button.tsx', component: 'Button', variants: ['primary', 'ghost'] },
  ],
  layoutExamples: [
    { path: 'src/App.tsx', excerpt: 'const client = createClient(ghp_abcdefghijklmnopqrst);' },
  ],
  notes: [],
});

const textFor = ({
  goal = 'ship the wireframe role',
  agentName = 'scout',
  planTitle = 'Ship it',
  designProfile = null,
}: {
  readonly goal?: string;
  readonly agentName?: string;
  readonly planTitle?: string;
  readonly designProfile?: DesignProfile | null;
} = {}): string =>
  buildWireframeContext({
    fidelity: designProfile === null ? 'low' : 'high',
    session: sessionWith({ goal }),
    agents: [agentWith({ name: agentName })],
    transcripts,
    artifacts: [planWith({ title: planTitle })],
    designProfile,
    capturedAt: NOW,
  }).text;

describe('buildWireframeContext', () => {
  it('redacts a secret carried in an agent name', () => {
    const text = textFor({ agentName: 'deploy ghp_abcdefghijklmnopqrst' });
    expect(text).not.toContain('ghp_abcdefghijklmnopqrst');
    expect(text).toContain(REDACTED);
  });

  it('redacts a secret carried in a plan title', () => {
    const text = textFor({ planTitle: 'rotate password: hunter2hunter2' });
    expect(text).not.toContain('hunter2hunter2');
    expect(text).toContain(REDACTED);
  });

  it('redacts a secret carried in the session goal', () => {
    const text = textFor({ goal: 'wire up api_key=abcdef123456 in the header' });
    expect(text).not.toContain('abcdef123456');
    expect(text).toContain(REDACTED);
  });

  it('redacts secrets read out of the repository design profile', () => {
    const text = textFor({ designProfile: profileWith() });
    expect(text).not.toContain('sk-live-abcdefghijklmnop');
    expect(text).not.toContain('ghp_abcdefghijklmnopqrst');
    expect(text).toContain('--accent: #3355ff');
  });
});
