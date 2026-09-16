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
import { ARTIFACT_BRIEF_CLIP_NOTE, ARTIFACT_BRIEF_LIMITS } from '../artifacts/artifactBrief';
import {
  SESSION_GOAL_CLIP_NOTE,
  SESSION_GOAL_LIMITS,
  sessionGoalText,
} from '../artifacts/sessionGoalText';
import { REDACTED } from '../../shared/utils/redactSecrets';
import {
  buildWireframeContext,
  WIREFRAME_CONTEXT_LIMITS,
  type WireframeContext,
} from './buildWireframeContext';
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

type TextForParams = {
  readonly brief?: string | null;
  readonly goal?: string;
  readonly goalSlot?: string | null;
  readonly agentName?: string;
  readonly planTitle?: string;
  readonly designProfile?: DesignProfile | null;
};

const contextFor = ({
  brief = null,
  goal = 'ship the wireframe role',
  goalSlot = null,
  agentName = 'scout',
  planTitle = 'Ship it',
  designProfile = null,
}: TextForParams = {}): WireframeContext => {
  const session = sessionWith({ goal });
  return buildWireframeContext({
    brief,
    fidelity: designProfile === null ? 'low' : 'high',
    target: 'both',
    session,
    goal: sessionGoalText({
      slots: goalSlot === null ? [] : [{ key: 'goal', value: goalSlot, enabled: true }],
      session,
    }),
    agents: [agentWith({ name: agentName })],
    transcripts,
    artifacts: [planWith({ title: planTitle })],
    designProfile,
    capturedAt: NOW,
  });
};

const textFor = (params: TextForParams = {}): string => contextFor(params).text;

describe('buildWireframeContext', () => {
  it('adds the explicit user request separately from the unchanged evidence and contract', () => {
    const baseline = textFor();
    const text = textFor({ brief: '  show the Harborline inbox\ninclude the empty state  ' });
    expect(text).toBe(
      `# user request\n\nshow the Harborline inbox\ninclude the empty state\n\n${baseline}`,
    );
  });

  it('redacts credentials in the user request', () => {
    const text = textFor({ brief: 'show access with api_key=harborline-test-value' });
    expect(text).toContain('# user request\n\nshow access with api_key=[redacted]');
    expect(text).not.toContain('harborline-test-value');
  });

  it.each([null, '', ' \n\t '])('keeps the default request for an empty brief (%j)', (brief) => {
    expect(textFor({ brief })).toBe(textFor());
  });

  it('notes a clipped brief in the truncation section', () => {
    const text = textFor({ brief: 'Harborline '.repeat(WIREFRAME_CONTEXT_LIMITS.total) });
    expect(text).toContain(ARTIFACT_BRIEF_CLIP_NOTE);
    expect(text.split('# user request\n\n')[1]?.split('\n\n# low fidelity')[0]).toHaveLength(
      ARTIFACT_BRIEF_LIMITS.chars,
    );
  });

  it('reports its inventory with the plans it kept session wide', () => {
    const context = buildWireframeContext({
      brief: null,
      fidelity: 'low',
      target: 'both',
      session: sessionWith({ goal: 'ship the wireframe role' }),
      goal: sessionGoalText({
        slots: [],
        session: sessionWith({ goal: 'ship the wireframe role' }),
      }),
      agents: [agentWith({ name: 'scout' })],
      transcripts,
      artifacts: [planWith({ title: 'Ship it' })],
      designProfile: null,
      capturedAt: NOW,
    });
    const plans = context.inventory.find((row) => row.id === 'plans');
    const theme = context.inventory.find((row) => row.id === 'theme');
    expect(plans?.summary).toContain('1 of 1 session plans');
    expect(plans?.detail).toContain('session plans, not scoped to a run');
    expect(theme?.summary).toBe('plain wireframe, no design files read');
  });

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

  it('records the session as a source', () => {
    const context = buildWireframeContext({
      brief: null,
      fidelity: 'low',
      target: 'both',
      session: sessionWith({ goal: 'ship the wireframe role' }),
      goal: sessionGoalText({
        slots: [],
        session: sessionWith({ goal: 'ship the wireframe role' }),
      }),
      agents: [agentWith({ name: 'scout' })],
      transcripts,
      artifacts: [planWith({ title: 'Ship it' })],
      designProfile: null,
      capturedAt: NOW,
    });
    expect(context.sourceIds).toContain(SESSION_ID);
  });

  it('states the target the user picked and names it in the inventory', () => {
    const forTarget = (target: 'mobile' | 'desktop' | 'both') =>
      buildWireframeContext({
        brief: null,
        fidelity: 'low',
        target,
        session: sessionWith({ goal: 'ship the wireframe role' }),
        goal: sessionGoalText({
          slots: [],
          session: sessionWith({ goal: 'ship the wireframe role' }),
        }),
        agents: [agentWith({ name: 'scout' })],
        transcripts,
        artifacts: [planWith({ title: 'Ship it' })],
        designProfile: null,
        capturedAt: NOW,
      });
    const desktop = forTarget('desktop');
    expect(desktop.text).toContain('target: desktop.');
    expect(desktop.text).toContain('set viewport to "desktop" on every screen');
    expect(desktop.inventory.find((row) => row.id === 'target')?.summary).toBe('drawn for desktop');
    const phone = forTarget('mobile');
    expect(phone.text).toContain('target: phone.');
    expect(phone.text).not.toContain('set viewport to "desktop" on every screen');
    expect(forTarget('both').inventory.find((row) => row.id === 'target')?.summary).toBe(
      'drawn for phone and desktop',
    );
  });
});

describe('buildWireframeContext session goal', () => {
  const LONG_GOAL = [
    'Northwind settles ledger-core postings twice a day and the second pass rounds the residual away.',
    'Walk the notify-relay receipts against the ledger and show where the cent goes missing.',
  ].join('\n\n');

  it('leaves out the goal block when the slot says no more than the title', () => {
    expect(textFor()).not.toContain('## goal');
  });

  it('carries the goal the user wrote in its own block after the header', () => {
    const text = textFor({ goalSlot: LONG_GOAL });
    expect(text).toContain(`## goal\n\n${LONG_GOAL}`);
    expect(text.indexOf('## goal')).toBeLessThan(text.indexOf('## product evidence'));
  });

  it('calls the header line the title once a fuller goal follows it', () => {
    const text = textFor({ goalSlot: LONG_GOAL });
    expect(text).toContain('session title: ship the wireframe role');
    expect(text).not.toContain('session goal: ');
  });

  it('keeps the header line the goal when nothing fuller follows it', () => {
    const text = textFor();
    expect(text).toContain('session goal: ship the wireframe role');
    expect(text).not.toContain('session title: ');
  });

  it('redacts a secret carried in the goal the user wrote', () => {
    const text = textFor({ goalSlot: `${LONG_GOAL}\n\nuse api_key=harborline-test-value` });
    expect(text).not.toContain('harborline-test-value');
    expect(text).toContain(REDACTED);
  });

  it('reports the goal the user wrote in the inventory', () => {
    const row = contextFor({ goalSlot: LONG_GOAL }).inventory.find((entry) => entry.id === 'goal');
    expect(row?.state).toBe('included');
    expect(row?.detail).toEqual([`the goal you wrote, ${LONG_GOAL.length} characters`]);
  });

  it('keeps the goal inventory row bare when only the title is sent', () => {
    const row = contextFor().inventory.find((entry) => entry.id === 'goal');
    expect(row?.state).toBe('included');
    expect(row?.detail).toEqual([]);
  });

  it('notes a clipped goal in the truncation section and the inventory', () => {
    const context = contextFor({
      goalSlot: 'Harborline '.repeat(SESSION_GOAL_LIMITS.chars),
    });
    expect(context.truncations).toContain(SESSION_GOAL_CLIP_NOTE);
    expect(context.text).toContain(SESSION_GOAL_CLIP_NOTE);
    expect(context.inventory.find((entry) => entry.id === 'goal')?.state).toBe('partial');
  });
});
