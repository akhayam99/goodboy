// @vitest-environment happy-dom

const holder = vi.hoisted(() => {
  const state: { db: unknown } = { db: null };
  return state;
});

vi.mock('../../../shared/lib/db', () => ({
  get tauriDatabase() {
    return holder.db;
  },
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdoptionOfAgent, type Database } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import {
  AUTO_SEED_NOW,
  AUTO_SEED_SESSION,
  seedAutoSession,
} from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AgentId, type WorkflowRunId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { useAppStore } from '../../../store';
import type { AppStore } from '../../../store/store';
import { adoptAgent } from '../../../store/slices/auto/adoptAgent';
import { MOVE_TO_AUTO_EVENT } from '../../auto/adopt/moveToAutoEvent';
import { runRoutesKey } from '../../session/startRun/runRoutesSetting';
import { resolveActions } from '../resolveActions';
import type { ActionEnv } from '../types';
import { AGENT_KIND, type AgentFacts } from './agent';

const SOURCE = brandId<AgentId>({ value: 'agent-source' });
const TARGET = { kind: 'agent', sessionId: AUTO_SEED_SESSION, agentId: SOURCE } as const;

const factsOf = (overrides: Partial<AgentFacts> = {}): AgentFacts => {
  const facts = AGENT_KIND.facts({ state: useAppStore.getState(), target: TARGET });
  if (facts === null) {
    throw new Error('no facts');
  }
  return { ...facts, ...overrides };
};

const idsOf = (facts: AgentFacts): ReadonlyArray<string> =>
  resolveActions({ definitions: AGENT_KIND.actions, facts }).map((action) => action.id);

let db: Database;

const sourceAgent = () =>
  anAgent({
    id: SOURCE,
    sessionId: AUTO_SEED_SESSION,
    name: 'Implementer',
    status: 'completed',
    kind: 'implementer',
  });

beforeEach(async () => {
  db = await makeMigratedTestDatabase();
  holder.db = db;
  await seedAutoSession({ db, agentIds: ['agent-source'] });
  await db.execute("UPDATE agents SET name = 'Implementer', kind = 'implementer' WHERE id = ?", [
    SOURCE,
  ]);
  useAppStore.setState({
    sessionPhaseRuns: { [AUTO_SEED_SESSION]: [sourceAgent()] },
    agentTurnState: {},
    agentKindOverride: {},
    autoTreeViews: {},
    settings: {},
    transcripts: {},
  });
});

describe('the Move to Auto and Detach from Auto verbs of an agent', () => {
  it('keeps Auto on even when an old experiment row still says false', () => {
    useAppStore.setState({ settings: { 'agents.autoExperiment': 'false' } });
    expect(factsOf().isAutoOn).toBe(true);
  });

  it('hides Move to Auto while the experiment is off', () => {
    expect(idsOf(factsOf({ isAutoOn: false }))).not.toContain('agent.moveToAuto');
  });

  it('shows Move to Auto on a standalone agent of a standard role when it is on', () => {
    const facts = factsOf({ isAutoOn: true });

    expect(facts.canMoveToAuto).toBe(true);
    const found = resolveActions({ definitions: AGENT_KIND.actions, facts }).find(
      (action) => action.id === 'agent.moveToAuto',
    );
    expect(found).toMatchObject({ label: 'Let Auto take it from here', blockedReason: null });
  });

  it('blocks it with a reason while a turn is running', () => {
    const found = resolveActions({
      definitions: AGENT_KIND.actions,
      facts: factsOf({ isAutoOn: true, isTurnLive: true }),
    }).find((action) => action.id === 'agent.moveToAuto');

    expect(found?.blockedReason).toBe('Wait for the turn to end first.');
  });

  it('is not offered on a step of a Run, on an Auto agent or on a kind with no role', () => {
    useAppStore.setState({
      sessionPhaseRuns: {
        [AUTO_SEED_SESSION]: [
          { ...sourceAgent(), workflowRunId: brandId<WorkflowRunId>({ value: 'run-harborline' }) },
        ],
      },
    });
    expect(factsOf({ isAutoOn: true }).canMoveToAuto).toBe(false);

    useAppStore.setState({
      sessionPhaseRuns: { [AUTO_SEED_SESSION]: [{ ...sourceAgent(), kind: 'auto' }] },
    });
    expect(factsOf({ isAutoOn: true }).canMoveToAuto).toBe(false);

    useAppStore.setState({
      sessionPhaseRuns: { [AUTO_SEED_SESSION]: [{ ...sourceAgent(), kind: 'resolver' }] },
    });
    expect(factsOf({ isAutoOn: true }).canMoveToAuto).toBe(false);
  });

  it('is offered on old rows only, never on an agent Start a run routed', () => {
    useAppStore.setState({
      settings: {
        [runRoutesKey({ sessionId: AUTO_SEED_SESSION })]: JSON.stringify({
          [SOURCE]: {
            shape: 'lead',
            row: 1,
            presetName: null,
            closeness: null,
            role: 'implementer',
            choice: 'One agent that starts what it needs',
            why: 'you picked it',
          },
        }),
      },
    });

    expect(factsOf({ isAutoOn: true }).canMoveToAuto).toBe(false);
  });

  it('is offered on an old Generalist that has no stored kind', () => {
    useAppStore.setState({
      sessionPhaseRuns: { [AUTO_SEED_SESSION]: [{ ...sourceAgent(), kind: undefined }] },
    });

    expect(factsOf({ isAutoOn: true }).canMoveToAuto).toBe(true);
  });

  it('is not offered inside a tree, and offers Detach from Auto on an adopted agent', async () => {
    let counter = 0;
    await adoptAgent({
      db,
      sessionId: AUTO_SEED_SESSION,
      sourceAgentId: SOURCE,
      source: {
        kind: 'implementer',
        roleLabel: 'Implementer',
        isTurnLive: false,
        goal: '',
        lastReply: '',
        mountLabel: null,
        provider: 'anthropic',
        model: 'sonnet',
        effort: 'medium',
      },
      instruction: '',
      autoRouting: { provider: 'anthropic', model: 'opus', effort: 'medium' },
      primaryMountId: null,
      capUsd: 5,
      nowMs: AUTO_SEED_NOW,
      newId: () => {
        counter += 1;
        return `adopt-${counter}`;
      },
    });
    await useAppStore.getState().loadAutoTrees({ sessionId: AUTO_SEED_SESSION });

    const facts = factsOf({ isAutoOn: true });

    expect(facts).toMatchObject({ canMoveToAuto: false, isAdopted: true });
    expect(idsOf(facts)).toContain('agent.detachFromAuto');
    expect(idsOf(facts)).not.toContain('agent.moveToAuto');
  });

  it('takes Message this agent away from an agent that Auto owns', () => {
    expect(idsOf(factsOf({ isAdopted: false }))).toContain('agent.message');
    expect(idsOf(factsOf({ isAdopted: true }))).not.toContain('agent.message');
  });

  it('keeps Detach from Auto while the experiment is off, because it is the way back', () => {
    expect(idsOf(factsOf({ isAutoOn: false, isAdopted: true }))).toContain('agent.detachFromAuto');
  });

  it('does not offer Detach from Auto on an agent that was never moved', () => {
    expect(idsOf(factsOf({ isAdopted: false }))).not.toContain('agent.detachFromAuto');
  });
});

type EnvParams = {
  readonly navigate: AppStore['navigate'];
  readonly reportError: AppStore['reportError'];
};

const envOf = ({ navigate, reportError }: EnvParams): ActionEnv => {
  useAppStore.setState({ navigate, reportError });
  return envWith();
};

const envWith = (): ActionEnv => ({
  getState: useAppStore.getState,
  showToast: vi.fn(),
  copyText: vi.fn(async () => undefined),
  origin: 'menu',
  anchorKey: null,
  viewing: null,
});

describe('running the verbs', () => {
  it('opens the chat and asks the pane to show the Move to Auto panel', async () => {
    vi.useFakeTimers();
    const navigate = vi.fn<AppStore['navigate']>();
    const heard: Array<unknown> = [];
    window.addEventListener(MOVE_TO_AUTO_EVENT, (event) => {
      heard.push(event instanceof CustomEvent ? event.detail : null);
    });
    const action = AGENT_KIND.actions.find((entry) => entry.id === 'agent.moveToAuto');

    await action?.run({
      facts: factsOf({ isAutoOn: true }),
      env: envOf({ navigate, reportError: async () => undefined }),
      choice: null,
    });
    vi.advanceTimersByTime(100);
    vi.useRealTimers();

    expect(navigate).toHaveBeenCalledOnce();
    expect(heard).toEqual([{ agentId: SOURCE }]);
  });

  it('detaches the agent and says it is back', async () => {
    let counter = 0;
    await adoptAgent({
      db,
      sessionId: AUTO_SEED_SESSION,
      sourceAgentId: SOURCE,
      source: {
        kind: 'implementer',
        roleLabel: 'Implementer',
        isTurnLive: false,
        goal: '',
        lastReply: '',
        mountLabel: null,
        provider: 'anthropic',
        model: 'sonnet',
        effort: 'medium',
      },
      instruction: '',
      autoRouting: { provider: 'anthropic', model: 'opus', effort: 'medium' },
      primaryMountId: null,
      capUsd: 5,
      nowMs: AUTO_SEED_NOW,
      newId: () => {
        counter += 1;
        return `adopt-${counter}`;
      },
    });
    const env = envOf({ navigate: vi.fn(), reportError: async () => undefined });
    const action = AGENT_KIND.actions.find((entry) => entry.id === 'agent.detachFromAuto');

    const outcome = await action?.run({
      facts: factsOf({ isAdopted: true }),
      env,
      choice: null,
    });

    expect(outcome).toBe('done');
    expect(await getAdoptionOfAgent({ db, agentId: SOURCE })).toBeNull();
    expect(env.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'success', message: 'Implementer is back in your hands.' }),
    );
  });

  it('reports why when the agent cannot be detached and changes nothing', async () => {
    const reportError = vi.fn<AppStore['reportError']>(async () => undefined);
    const env = envOf({ navigate: vi.fn(), reportError });
    const action = AGENT_KIND.actions.find((entry) => entry.id === 'agent.detachFromAuto');

    const outcome = await action?.run({
      facts: factsOf({ isAdopted: true }),
      env,
      choice: null,
    });

    expect(outcome).toBe('unchanged');
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't detach from Auto" }),
    );
  });
});
