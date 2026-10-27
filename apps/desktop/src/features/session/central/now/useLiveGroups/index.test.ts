// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  aDelegation,
  aView,
  FIXTURE_NOW,
  FIXTURE_ROOT,
} from '../../../../auto/testing/autoViewFixtures';
import { aNowAgent, NOW_SESSION, NOW_STARTED_AT, nowModelOf } from '../testing/nowModelOf';
import { useLiveGroups } from './index';

const AUTO_ROOT = anAgent({
  id: FIXTURE_ROOT,
  sessionId: NOW_SESSION,
  kind: 'auto',
  name: 'Check the payout docs',
  status: 'running',
  startedAt: NOW_STARTED_AT,
});

const FIXER = anAgent({
  id: brandId<AgentId>({ value: 'agent-fixer' }),
  sessionId: NOW_SESSION,
  parentAgentId: FIXTURE_ROOT,
  name: 'Fixer',
  status: 'running',
});

const VIEW = aView({
  phase: 'waiting',
  delegations: [aDelegation({ key: 'fixer', role: 'implementer', state: 'running' })],
});

const AGENTS = [AUTO_ROOT, FIXER];

describe('useLiveGroups', () => {
  it('keeps the same array when a clock tick changes nothing', () => {
    const model = nowModelOf({ agents: AGENTS, autoTrees: [VIEW] });
    const view = renderHook(
      ({ now }: { readonly now: number }) => useLiveGroups({ model, agents: AGENTS, now }),
      { initialProps: { now: FIXTURE_NOW } },
    );
    const first = view.result.current;
    expect(first).toHaveLength(1);

    view.rerender({ now: FIXTURE_NOW + 15_000 });

    expect(view.result.current).toBe(first);
  });

  it('keeps the group objects that did not change when another one did', () => {
    const lone = aNowAgent({ key: 'lone', name: 'Lone agent', status: 'running' });
    const agents = [AUTO_ROOT, FIXER, lone];
    const model = nowModelOf({ agents, autoTrees: [VIEW] });
    const view = renderHook(
      ({ list }: { readonly list: typeof agents }) =>
        useLiveGroups({
          model: nowModelOf({ agents: list, autoTrees: [VIEW] }),
          agents: list,
          now: FIXTURE_NOW,
        }),
      { initialProps: { list: agents } },
    );
    const before = view.result.current;
    const autoBefore = before.find((group) => group.kind === 'auto');
    expect(model.autoTrees).toHaveLength(1);

    view.rerender({ list: [AUTO_ROOT, FIXER, { ...lone, status: 'blocked' }] });

    const autoAfter = view.result.current.find((group) => group.kind === 'auto');
    expect(autoAfter).toBe(autoBefore);
  });
});
