import { describe, expect, it } from 'vitest';
import type {
  TimelineAgentEntry,
  TimelineRunEntry,
  TimelineTopLevelEntry,
} from '../../../../timeline/buildTimelineGroups';
import {
  agentGroupsOf,
  isModelNameShown,
  isProviderGlyphShown,
  routingFactsOf,
  type TimelineRoute,
} from './timelineRouting';

const route = (
  agentId: string,
  groupId: string,
  provider: string,
  model: string,
): TimelineRoute => ({
  agentId,
  groupId,
  provider,
  model,
});

const agentEntry = (id: string, children: ReadonlyArray<TimelineAgentEntry> = []) =>
  ({ kind: 'agent', id: `agent:${id}`, agent: { id }, children }) as unknown as TimelineAgentEntry;

describe('routingFactsOf', () => {
  it('shows the glyph only when the session uses two providers or more', () => {
    const one = routingFactsOf({
      routes: [route('a', 'session', 'anthropic', 'm1'), route('b', 'session', 'anthropic', 'm2')],
    });
    const two = routingFactsOf({
      routes: [route('a', 'session', 'anthropic', 'm1'), route('b', 'session', 'codex', 'm2')],
    });

    expect(one.isMultiProvider).toBe(false);
    expect(two.isMultiProvider).toBe(true);
  });

  it('hides the model of rows that match their group and shows the ones that differ', () => {
    const facts = routingFactsOf({
      routes: [
        route('a', 'run:1', 'anthropic', 'sonnet'),
        route('b', 'run:1', 'anthropic', 'sonnet'),
        route('c', 'run:1', 'anthropic', 'opus'),
      ],
    });

    expect([...facts.modelShownAgentIds]).toEqual(['c']);
  });

  it('shows both models of a tied group, since neither one is the group model', () => {
    const facts = routingFactsOf({
      routes: [
        route('a', 'run:1', 'anthropic', 'sonnet'),
        route('b', 'run:1', 'anthropic', 'opus'),
      ],
    });

    expect([...facts.modelShownAgentIds].sort()).toEqual(['a', 'b']);
  });

  it('keeps the model of a row that has no group mate to compare with', () => {
    const facts = routingFactsOf({ routes: [route('a', 'run:1', 'anthropic', 'sonnet')] });

    expect(facts.modelShownAgentIds.has('a')).toBe(true);
  });

  it('compares each group on its own', () => {
    const facts = routingFactsOf({
      routes: [
        route('a', 'run:1', 'anthropic', 'sonnet'),
        route('b', 'run:1', 'anthropic', 'sonnet'),
        route('c', 'run:2', 'anthropic', 'opus'),
        route('d', 'run:2', 'anthropic', 'opus'),
      ],
    });

    expect(facts.modelShownAgentIds.size).toBe(0);
  });
});

describe('visibility helpers', () => {
  it('show everything without facts, so other lists keep their columns', () => {
    expect(isProviderGlyphShown({ facts: null })).toBe(true);
    expect(isModelNameShown({ facts: null, agentId: 'a' })).toBe(true);
  });

  it('show the name when the row has no agent id to look up', () => {
    const facts = routingFactsOf({
      routes: [route('a', 'g', 'anthropic', 'm'), route('b', 'g', 'anthropic', 'm')],
    });

    expect(isModelNameShown({ facts, agentId: undefined })).toBe(true);
    expect(isModelNameShown({ facts, agentId: 'a' })).toBe(false);
  });
});

describe('agentGroupsOf', () => {
  it('groups top-level agents together, run children by run and nested agents by parent', () => {
    const nested = agentEntry('nested');
    const parent = agentEntry('parent', [nested]);
    const inRun = agentEntry('inRun');
    const run = { kind: 'run', id: 'run:1', children: [inRun] } as unknown as TimelineRunEntry;
    const entries: ReadonlyArray<TimelineTopLevelEntry> = [agentEntry('top'), parent, run];

    const groups = agentGroupsOf({ entries }).map(({ agent, groupId }) => [
      agent.agent.id,
      groupId,
    ]);

    expect(groups).toEqual([
      ['top', 'session'],
      ['parent', 'session'],
      ['nested', 'agent:parent'],
      ['inRun', 'run:1'],
    ]);
  });
});
