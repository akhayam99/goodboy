// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { aWorkspace } from '@goodboy/types/testing';
import { brandId, type AgentId, type TurnEvent } from '@goodboy/types';
import { aDelegation, aPlanRow, aView } from '../../auto/testing/autoViewFixtures';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import {
  harborline,
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../workspace/testing/sessionColumn';
import { fixtureOf } from '../actions/testing/decideTestKit';
import { CONTRACT_VERSION } from '../contract/contractVersion';
import type { NeedsYouFields, SessionFields } from '../contract/projections';
import { LEAD_ASK_MAX } from './leadAskOf';
import { projectionFieldsOf } from './projectionFieldsOf';
import { scopeOfState } from './scopeOfState';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const NOW = Date.parse('2026-10-05T09:05:00.000Z');
const LEAD = 'agent-lead';
const BUILDER = 'agent-builder';
const northwind = aWorkspace({ name: 'Northwind', slug: 'northwind' });
const cascadia = aWorkspace({ name: 'Cascadia', slug: 'cascadia' });
const asking = sessionOf({ goal: '[HBL-412] Retry window for the webhook' });

const leadTree = (): AutoTreeView => {
  const view = aView({ phase: 'waiting', artifacts: [aPlanRow({ title: 'Ledger plan' })] });
  return { ...view, tree: { ...view.tree, rootAgentId: brandId<AgentId>({ value: LEAD }) } };
};

const textEvent = ({ delta }: { readonly delta: string }): TurnEvent =>
  fixtureOf<TurnEvent>({
    value: {
      kind: 'assistant_text',
      runId: 'run-1',
      delta,
      at: '2026-10-05T09:01:00.000Z',
    },
  });

const toolEvent = (): TurnEvent =>
  fixtureOf<TurnEvent>({
    value: {
      kind: 'tool_call_start',
      runId: 'run-1',
      toolUseId: 'tool-1',
      name: 'Bash',
      input: { command: 'cat .env' },
      at: '2026-10-05T09:02:00.000Z',
    },
  });

const seed = ({ ask }: { readonly ask: string }): void => {
  seedColumn({
    store: useAppStore,
    sessions: [asking],
    questions: [],
    mounts: [[asking, paymentsApi]],
  });
  useAppStore.setState({
    workspaces: [harborline, northwind, cascadia],
    sessionPhaseRuns: {
      [asking.id]: [
        fixtureOf({
          value: {
            id: LEAD,
            sessionId: asking.id,
            name: 'Lead',
            kind: 'auto',
            status: 'running',
            outputSummary: 'Plan is ready for your review.',
          },
        }),
        fixtureOf({
          value: {
            id: BUILDER,
            sessionId: asking.id,
            name: 'Builder',
            parentAgentId: LEAD,
            status: 'running',
          },
        }),
      ],
    },
    autoTreeViews: { [asking.id]: [leadTree()] },
    transcripts: { [LEAD]: [textEvent({ delta: ask }), toolEvent()] },
  });
};

const draftsOf = () => {
  const state = useAppStore.getState();
  const current = scopeOfState({
    workspace: harborline,
    state,
    sessions: state.sessions,
    isFullyLoaded: true,
  });
  const other = scopeOfState({
    workspace: northwind,
    state: { ...state, sessionProjectMounts: {}, sessionGithub: {}, sessionExternalTasks: {} },
    sessions: [],
    isFullyLoaded: false,
  });
  return projectionFieldsOf({
    scopes: [current, other],
    workspaces: state.workspaces,
    detailWorkspaceId: harborline.id,
    chips: { spendToday: null, limits: [] },
    now: NOW,
  });
};

const fieldsOf = <T,>(key: string): T => {
  const draft = draftsOf().find((candidate) => candidate.key === key);
  if (draft === undefined) {
    throw new Error(`no projection ${key}`);
  }
  return JSON.parse(JSON.stringify(draft.fields));
};

describe('contract version 10', () => {
  it('is the version the phone asks for', () => {
    expect(CONTRACT_VERSION).toBe(10);
  });
});

describe('needs you lists every workspace the Mac shows', () => {
  it('names each workspace, zero-move ones and one without a loaded scope included', () => {
    seed({ ask: 'Which currency should the ledger use?' });

    const { workspaces } = fieldsOf<NeedsYouFields>('needsYou');

    expect(workspaces.map((workspace) => workspace.name)).toEqual([
      harborline.name,
      'Northwind',
      'Cascadia',
    ]);
    expect(workspaces.find((workspace) => workspace.name === 'Northwind')?.moveCount).toBe(0);
    expect(workspaces.find((workspace) => workspace.name === 'Cascadia')?.moveCount).toBe(0);
    expect(workspaces[0]?.moveCount).toBeGreaterThan(0);
  });

  it('projects chats for every loaded workspace, not only the open one', () => {
    seed({ ask: 'Which currency should the ledger use?' });

    const keys = draftsOf().map((draft) => draft.key);

    expect(keys).toContain(`chats:${harborline.id}`);
    expect(keys).toContain(`chats:${northwind.id}`);
  });
});

describe('needs you row for the Lead carries its ask', () => {
  const leadRowOf = () =>
    fieldsOf<NeedsYouFields>('needsYou').rows.find((row) => row.reason === 'auto-needs-you');

  it('sends the text of the latest Lead message, never a tool call', () => {
    seed({ ask: 'I can ship the plan.\n\nShould the retry window be 30 or 60 seconds?' });

    const row = leadRowOf();

    expect(row?.ask?.question).toBe('Should the retry window be 30 or 60 seconds?');
    expect(JSON.stringify(row)).not.toContain('cat .env');
  });

  it('cuts a long ask and hides a secret', () => {
    seed({ ask: `Use ghp_${'a'.repeat(30)} and then ${'why '.repeat(400)}?` });

    const ask = leadRowOf()?.ask?.question ?? '';

    expect(ask.length).toBeLessThanOrEqual(LEAD_ASK_MAX);
    expect(ask).not.toContain('ghp_');
  });

  it('leaves the key out when the Lead has said nothing', () => {
    seed({ ask: 'x' });
    useAppStore.setState({ transcripts: {} });

    const row = leadRowOf();

    expect(row).toBeDefined();
    expect(Object.keys(row ?? {})).not.toContain('ask');
  });

  it('leaves the key out on every other row', () => {
    seed({ ask: 'Which currency?' });

    const others = fieldsOf<NeedsYouFields>('needsYou').rows.filter(
      (row) => row.reason !== 'auto-needs-you',
    );

    expect(others.every((row) => !Object.keys(row).includes('ask'))).toBe(true);
  });
});

describe('session activity line splits what the agent did', () => {
  const nowOf = () => fieldsOf<SessionFields>(`session:${harborline.id}:${asking.id}`).now;

  it('sends title and summary beside the joined text', () => {
    seed({ ask: 'Which currency?' });

    const line = nowOf().find((candidate) => candidate.id === LEAD);

    expect(line).toMatchObject({
      text: 'Lead: Plan is ready for your review.',
      title: 'Lead',
      summary: 'Plan is ready for your review.',
    });
  });

  it('leaves the summary out when the agent has none, and keeps the v9 text', () => {
    seed({ ask: 'Which currency?' });

    const line = nowOf().find((candidate) => candidate.id === BUILDER);

    expect(line?.text).toBe('Builder');
    expect(line?.title).toBe('Builder');
    expect(Object.keys(line ?? {})).not.toContain('summary');
  });
});

describe('needs you row for the Lead carries the pending proposal', () => {
  const proposalView = (): AutoTreeView => {
    const view = aView({
      phase: 'waiting',
      delegations: [
        aDelegation({
          key: 'impl',
          role: 'implementer',
          state: 'awaiting_confirm',
          alternatives: [
            { label: 'Scout the ledger first', role: 'scout' },
            { label: 'Review the plan', role: 'reviewer' },
            { label: 'A third one', role: 'scribe' },
          ],
        }),
      ],
    });
    return { ...view, tree: { ...view.tree, rootAgentId: brandId<AgentId>({ value: LEAD }) } };
  };

  it('lists the primary and at most two alternatives, each with a Mac-minted action id', () => {
    seed({ ask: 'I propose an implementer.' });
    useAppStore.setState({ autoTreeViews: { [asking.id]: [proposalView()] } });

    const row = fieldsOf<NeedsYouFields>('needsYou').rows.find(
      (candidate) => candidate.reason === 'auto-needs-you',
    );
    const proposal = row?.ask?.proposal;

    expect(proposal?.role).toBe('implementer');
    expect(proposal?.options.map((option) => option.key)).toEqual([
      'primary',
      'alternative-0',
      'alternative-1',
    ]);
    expect(proposal?.options[1]?.label).toBe('Scout the ledger first');
    expect(proposal?.options[0]?.actionId).toBe(
      `act:decideProposal:delegation-impl.primary:${proposal?.version}`,
    );
    expect(proposal?.notNowActionId).toBe(
      `act:decideProposal:delegation-impl.notNow:${proposal?.version}`,
    );
    expect(row?.ask?.question).toBe('I propose an implementer.');
  });

  it('hides the auto block from the question', () => {
    seed({
      ask: 'Shall I go?\n\n<<auto>>{"action":"propose","primary":{"role":"implementer","task":"x"}}<</auto>>',
    });
    useAppStore.setState({ autoTreeViews: { [asking.id]: [proposalView()] } });

    const row = fieldsOf<NeedsYouFields>('needsYou').rows.find(
      (candidate) => candidate.reason === 'auto-needs-you',
    );

    expect(JSON.stringify(row?.ask)).not.toContain('auto>>');
    expect(row?.ask?.question).toBe('Shall I go?');
  });
});
