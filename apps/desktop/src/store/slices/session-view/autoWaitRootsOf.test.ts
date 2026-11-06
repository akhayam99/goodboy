// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import {
  aDelegation,
  aView,
  FIXTURE_NOW,
  FIXTURE_ROOT,
  FIXTURE_SESSION,
} from '../../../features/auto/testing/autoViewFixtures';
import type { AutoTreeView } from '../auto-view/state';
import { autoWaitRootsOf } from './autoWaitRootsOf';

const words = vi.hoisted(() => ({ isRenamed: false }));

vi.mock('../../../features/auto/autoTreeWordOf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../features/auto/autoTreeWordOf')>();
  return {
    ...actual,
    autoTreeWordOf: (params: Parameters<typeof actual.autoTreeWordOf>[0]) => {
      const tree = actual.autoTreeWordOf(params);
      return words.isRenamed ? { ...tree, word: `Renamed ${tree.word}` } : tree;
    },
  };
});

const SESSION = aSession({ id: FIXTURE_SESSION });
const ROOT = anAgent({ id: FIXTURE_ROOT, sessionId: FIXTURE_SESSION, kind: 'auto' });

const FIXER = anAgent({
  id: brandId<AgentId>({ value: 'agent-fixer' }),
  sessionId: FIXTURE_SESSION,
  parentAgentId: FIXTURE_ROOT,
});

type WaitParams = {
  readonly view: AutoTreeView;
  readonly clockAt?: number;
};

const waitsOf = ({ view, clockAt = 0 }: WaitParams) =>
  autoWaitRootsOf({
    state: {
      agentTurnState: {},
      autoTreeViews: { [FIXTURE_SESSION]: [view] },
      autoClockAt: clockAt,
    },
    session: SESSION,
    agents: [ROOT, FIXER],
  }).map((root) => root.id);

afterEach(() => {
  words.isRenamed = false;
});

describe('autoWaitRootsOf', () => {
  it('counts an Auto that is blocked or asks you, never one that runs or rests', () => {
    expect(waitsOf({ view: aView({ phase: 'blocked' }) })).toEqual([FIXTURE_ROOT]);
    expect(waitsOf({ view: aView({ phase: 'waiting', capUsd: 1, spentUsd: 1 }) })).toEqual([
      FIXTURE_ROOT,
    ]);
    expect(waitsOf({ view: aView({ phase: 'deciding' }) })).toEqual([]);
    expect(waitsOf({ view: aView({ phase: 'done' }) })).toEqual([]);
    expect(waitsOf({ view: aView({ phase: 'stopped' }) })).toEqual([]);
  });

  it('counts an Auto whose child failed as stuck', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [aDelegation({ key: 'fixer', role: 'implementer', state: 'settled' })],
    });

    expect(waitsOf({ view })).toEqual([FIXTURE_ROOT]);
  });

  it('reads the real clock: a child that never started counts as stuck after a minute', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [aDelegation({ key: 'fixer', role: 'implementer', state: 'accepted' })],
    });

    expect(waitsOf({ view, clockAt: FIXTURE_NOW + 30_000 })).toEqual([]);
    expect(waitsOf({ view, clockAt: FIXTURE_NOW + 60_000 })).toEqual([FIXTURE_ROOT]);
  });

  it('keeps every count when the state words are renamed', () => {
    const views = [
      aView({ phase: 'blocked' }),
      aView({ phase: 'waiting', capUsd: 1, spentUsd: 1 }),
      aView({ phase: 'deciding' }),
      aView({ phase: 'done' }),
    ];
    const before = views.map((view) => waitsOf({ view }));

    words.isRenamed = true;

    expect(views.map((view) => waitsOf({ view }))).toEqual(before);
  });
});
