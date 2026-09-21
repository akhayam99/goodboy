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
import type { ArtifactAttachment } from '../artifacts/artifactAttachments';
import {
  SESSION_GOAL_CLIP_NOTE,
  SESSION_GOAL_LIMITS,
  sessionGoalText,
} from '../artifacts/sessionGoalText';
import { ARTIFACT_QUESTION_LIMIT } from '../artifacts/artifactQuestionContract';
import { REDACTED } from '../../shared/utils/redactSecrets';
import {
  buildWireframeContext,
  WIREFRAME_CONTEXT_LIMITS,
  type WireframeContext,
} from './buildWireframeContext';
import type { DesignEvidence, DesignProfile } from './collectDesignProfile';

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
  readonly designEvidence?: DesignEvidence;
};

const contextFor = ({
  brief = null,
  goal = 'ship the wireframe role',
  goalSlot = null,
  agentName = 'scout',
  planTitle = 'Ship it',
  designEvidence = { source: 'none' },
}: TextForParams = {}): WireframeContext => {
  const session = sessionWith({ goal });
  return buildWireframeContext({
    brief,
    attachments: [],
    fidelity: designEvidence.source === 'none' ? 'low' : 'high',
    target: 'both',
    session,
    goal: sessionGoalText({
      slots: goalSlot === null ? [] : [{ key: 'goal', value: goalSlot, enabled: true }],
      session,
    }),
    agents: [agentWith({ name: agentName })],
    transcripts,
    artifacts: [planWith({ title: planTitle })],
    designEvidence,
    capturedAt: NOW,
  });
};

const textFor = (params: TextForParams = {}): string => contextFor(params).text;

describe('buildWireframeContext question contract', () => {
  it('tells the agent to ask at most two marked questions before the document', () => {
    const text = textFor();
    expect(text).toContain('## questions');
    expect(text).toContain(
      '<<ctx-question suggestions="first option|second option" recommended="first option" select="one" blocking="true">>the question<</ctx-question>>',
    );
    expect(text).toContain(`at most ${ARTIFACT_QUESTION_LIMIT} questions`);
    expect(text).toContain(
      'when no question is blocking, put the questions before the artifact block, in the same turn',
    );
  });

  it('stops the turn at the questions when one of them blocks', () => {
    const text = textFor();
    expect(text).toContain(
      'when any question is blocking, send the questions and nothing else: no artifact block in that turn',
    );
    expect(text).toContain('the answers come back to you as a new turn');
  });

  it('teaches when a question earns the blocking mark', () => {
    const text = textFor();
    expect(text).toContain('mark a question blocking="true" only when both of these hold');
    expect(text).toContain('the answer changes what the wireframe says rather than how it says it');
    expect(text).toContain('a preference with a defensible default is never blocking');
  });

  it('keeps the contract out of the capped evidence so a long pack never drops it', () => {
    const text = textFor({ brief: 'Harborline '.repeat(WIREFRAME_CONTEXT_LIMITS.total) });
    expect(text).toContain('## questions');
    expect(text.indexOf('## questions')).toBeGreaterThan(text.indexOf('## truncation'));
    expect(text.indexOf('## questions')).toBeLessThan(text.indexOf('## document contract'));
  });

  it('names the wireframe home for the assumption it made', () => {
    expect(textFor()).toContain('a node note on the screen it decides');
  });
});

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
      attachments: [],
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
      designEvidence: { source: 'none' },
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
    const text = textFor({ designEvidence: { source: 'mount', profile: profileWith() } });
    expect(text).not.toContain('sk-live-abcdefghijklmnop');
    expect(text).not.toContain('ghp_abcdefghijklmnopqrst');
    expect(text).toContain('--accent: #3355ff');
  });

  it('records the session as a source', () => {
    const context = buildWireframeContext({
      brief: null,
      attachments: [],
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
      designEvidence: { source: 'none' },
      capturedAt: NOW,
    });
    expect(context.sourceIds).toContain(SESSION_ID);
  });

  it('states the target the user picked and names it in the inventory', () => {
    const forTarget = (target: 'mobile' | 'desktop' | 'both') =>
      buildWireframeContext({
        brief: null,
        attachments: [],
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
        designEvidence: { source: 'none' },
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

describe('buildWireframeContext agent budgets', () => {
  const agentAt = ({ id, ordinal }: { readonly id: string; readonly ordinal: number }): Agent => ({
    id: id as AgentId,
    sessionId: SESSION_ID,
    ordinal,
    name: `scout ${ordinal}`,
    status: 'completed',
  });

  const turnsWith = ({
    text,
    at,
  }: {
    readonly text: string;
    readonly at: IsoDateTime;
  }): ReadonlyArray<TurnEvent> => [
    { kind: 'assistant_text', runId: 'run-1' as ProviderRunId, delta: text, at },
  ];

  const packWith = ({
    agents,
    messages,
    brief = null,
    scoutSection = null,
    attachments = [],
  }: {
    readonly agents: ReadonlyArray<Agent>;
    readonly messages: Readonly<Record<string, ReadonlyArray<TurnEvent>>>;
    readonly brief?: string | null;
    readonly scoutSection?: string | null;
    readonly attachments?: ReadonlyArray<ArtifactAttachment>;
  }): WireframeContext => {
    const session = sessionWith({ goal: 'ship the wireframe role' });
    return buildWireframeContext({
      brief,
      attachments,
      fidelity: 'low',
      target: 'both',
      session,
      goal: sessionGoalText({ slots: [], session }),
      agents,
      transcripts: messages,
      artifacts: [planWith({ title: 'Ship it' })],
      designEvidence: { source: 'none' },
      scoutSection,
      capturedAt: NOW,
    });
  };

  const messageFor = ({
    text,
    agentId,
  }: {
    readonly text: string;
    readonly agentId: string;
  }): string => text.split(`(${agentId})\n\n`)[1]?.split(/\n\n#/)[0] ?? '';

  const sentences = ({ word, count }: { readonly word: string; readonly count: number }): string =>
    `${word} runs the inbox and settles the ledger. `.repeat(count).trim();

  it('sends a lone long final message whole instead of cutting it at a flat character limit', () => {
    const long = sentences({ word: 'alpha', count: 400 });
    expect(long.length).toBeGreaterThan(900);
    const context = packWith({
      agents: [agentAt({ id: 'agent-long', ordinal: 0 })],
      messages: { 'agent-long': turnsWith({ text: long, at: NOW }) },
    });
    expect(context.text).toContain(long);
    expect(context.truncations).not.toContain('agent agent-long: final message truncated');
  });

  it('serves the newest final message before it expands an older one', () => {
    const newest = sentences({ word: 'newest', count: 3_000 });
    const older = sentences({ word: 'older', count: 3_000 });
    const context = packWith({
      agents: [
        agentAt({ id: 'agent-older', ordinal: 0 }),
        agentAt({ id: 'agent-newest', ordinal: 1 }),
      ],
      messages: {
        'agent-older': turnsWith({ text: older, at: '2026-09-01T00:00:00.000Z' as IsoDateTime }),
        'agent-newest': turnsWith({ text: newest, at: '2026-09-02T00:00:00.000Z' as IsoDateTime }),
      },
    });
    const keptNewest = messageFor({ text: context.text, agentId: 'agent-newest' });
    const keptOlder = messageFor({ text: context.text, agentId: 'agent-older' });
    expect(keptOlder.length).toBeGreaterThan(0);
    expect(keptOlder.length).toBeLessThanOrEqual(WIREFRAME_CONTEXT_LIMITS.olderAgentReserve);
    expect(keptNewest.length).toBeGreaterThan(keptOlder.length * 10);
  });

  it('cuts a message too large for the whole allowance on a boundary and discloses it', () => {
    const huge = sentences({ word: 'alpha', count: 4_000 });
    expect(huge.length).toBeGreaterThan(WIREFRAME_CONTEXT_LIMITS.total);
    const context = packWith({
      agents: [agentAt({ id: 'agent-huge', ordinal: 0 })],
      messages: { 'agent-huge': turnsWith({ text: huge, at: NOW }) },
    });
    const kept = messageFor({ text: context.text, agentId: 'agent-huge' });
    expect(kept.endsWith('...')).toBe(true);
    expect(kept.slice(0, -3).endsWith('.')).toBe(true);
    expect(context.truncations).toContain('agent agent-huge: final message truncated');
    expect(context.text).toContain('agent agent-huge: final message truncated');
  });

  it('keeps the complete returned text within the total, request and question contract included', () => {
    const agents = Array.from({ length: 10 }, (_, index) =>
      agentAt({ id: `agent-${index}`, ordinal: index }),
    );
    const messages = Object.fromEntries(
      agents.map((agent, index) => [
        agent.id,
        turnsWith({
          text: sentences({ word: `agent${index}`, count: 2_000 }),
          at: `2026-09-0${index % 9}T00:00:00.000Z` as IsoDateTime,
        }),
      ]),
    );
    const context = packWith({
      agents,
      messages,
      brief: 'Harborline '.repeat(WIREFRAME_CONTEXT_LIMITS.total),
      scoutSection: `## scouts\n\n${sentences({ word: 'scout', count: 2_000 })}`,
    });
    expect(context.text.length).toBeLessThanOrEqual(WIREFRAME_CONTEXT_LIMITS.total);
    expect(context.text).toContain('# user request');
    expect(context.text).toContain('## questions');
    expect(context.text).toContain('## document contract');
    expect(context.inventory.find((row) => row.id === 'size')?.state).toBe('partial');
  });

  it('drops the whole row of an agent whose budget is gone and says so', () => {
    const agents = Array.from({ length: 8 }, (_, index) =>
      agentAt({ id: `agent-${index}`, ordinal: index }),
    );
    const messages = Object.fromEntries(
      agents.map((agent, index) => [
        agent.id,
        turnsWith({
          text: sentences({ word: `agent${index}`, count: 60 }),
          at: `2026-09-0${index + 1}T00:00:00.000Z` as IsoDateTime,
        }),
      ]),
    );
    const context = packWith({
      agents,
      messages,
      attachments: Array.from({ length: 500 }, (_, index) => ({
        id: `att-${index}`,
        fileName: `screen-${index}.png`,
        mimeType: 'image/png',
        relPath: `.goodboy/attachments/att-${index}-a-very-long-screen-name-for-the-budget.png`,
      })),
    });
    const dropped = context.truncations.filter((note) => note.endsWith('dropped to fit'));
    expect(dropped.length).toBeGreaterThan(0);
    dropped.forEach((note) => {
      const id = note.split(':')[0]?.replace('agent ', '') ?? '';
      expect(context.text).not.toContain(`(${id})`);
      expect(context.sourceIds).not.toContain(id);
    });
    expect(context.inventory.find((row) => row.id === 'agents')?.detail).toContain(
      `${dropped.length} did not fit and were dropped`,
    );
    expect(context.text.length).toBeLessThanOrEqual(WIREFRAME_CONTEXT_LIMITS.total);
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

  it('counts the redacted goal in the inventory, not the raw one', () => {
    const goalSlot = `${LONG_GOAL}\n\nuse api_key=harborline-test-value`;
    const goal = sessionGoalText({
      slots: [{ key: 'goal', value: goalSlot, enabled: true }],
      session: sessionWith({ goal: 'ship the wireframe role' }),
    });
    expect(goal.packText.length).toBeLessThan(goal.editorText.length);
    const row = contextFor({ goalSlot }).inventory.find((entry) => entry.id === 'goal');
    expect(row?.detail).toEqual([`the goal you wrote, ${goal.packText.length} characters`]);
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

describe('buildWireframeContext high fidelity theme', () => {
  const emptyProfile: DesignProfile = {
    themeName: 'generic',
    commitSha: 'abc1234',
    tailwind: null,
    tokens: [],
    variants: [],
    layoutExamples: [],
    notes: ['the walk found no tailwind config in this repository'],
  };

  const highFidelity = ({
    designEvidence,
  }: {
    readonly designEvidence: DesignEvidence;
  }): WireframeContext => {
    const session = sessionWith({ goal: 'ship the wireframe role' });
    return buildWireframeContext({
      brief: null,
      attachments: [],
      fidelity: 'high',
      target: 'both',
      session,
      goal: sessionGoalText({ slots: [], session }),
      agents: [agentWith({ name: 'scout' })],
      transcripts,
      artifacts: [planWith({ title: 'Ship it' })],
      designEvidence,
      capturedAt: NOW,
    });
  };

  it('sends the profile it read when the walk found design files', () => {
    const context = highFidelity({
      designEvidence: { source: 'mount', profile: profileWith() },
    });
    expect(context.text).toContain('## design profile');
    expect(context.text).toContain('this profile was read by the app from the mounted repository');
    const theme = context.inventory.find((row) => row.id === 'theme');
    expect(theme?.summary).toContain('design profile from goodboy at abc1234');
    expect(theme?.state).toBe('included');
  });

  it('says the repository was walked and held nothing, and keeps the theme generic', () => {
    const context = highFidelity({ designEvidence: { source: 'mount', profile: emptyProfile } });
    expect(context.text).toContain(
      'the mounted repository was walked and it holds no design file the app could read',
    );
    expect(context.text).toContain('set theme.name to "generic"');
    expect(context.text).toContain('never invent branding');
    expect(context.text).not.toContain('## design profile');
    const theme = context.inventory.find((row) => row.id === 'theme');
    expect(theme?.summary).toBe('the mounted repository was walked and no design file was found');
    expect(theme?.state).toBe('missing');
    expect(theme?.detail).toEqual(emptyProfile.notes);
  });

  it('says no repository is mounted when there is nothing to read', () => {
    const context = highFidelity({ designEvidence: { source: 'none' } });
    expect(context.text).toContain('no repository is mounted, so nothing could be read');
    expect(context.text).toContain('set theme.name to "generic"');
    expect(context.text).not.toContain('## design profile');
    const theme = context.inventory.find((row) => row.id === 'theme');
    expect(theme?.summary).toBe('no repository is mounted, so no design file was read');
    expect(theme?.state).toBe('missing');
  });
});
