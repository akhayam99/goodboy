// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AutoRouting, AutoRoutingCandidate } from '@goodboy/types';
import { routingWhyOf } from './routingWhyOf';

const row = (over: Partial<AutoRoutingCandidate>): AutoRoutingCandidate => ({
  provider: 'anthropic',
  model: 'sonnet-5.5',
  effort: 'medium',
  order: 1,
  isLighter: false,
  room: { usedPercent: 62, isEstimated: false },
  load: 3,
  cause: null,
  ...over,
});

const CANDIDATES: ReadonlyArray<AutoRoutingCandidate> = [
  row({}),
  row({ provider: 'cursor', order: 2, room: { usedPercent: 40.4, isEstimated: true }, load: 1 }),
  row({ provider: 'codex', model: 'gpt-6.1-sol', order: 3, room: null, load: 0 }),
  row({ provider: 'cursor', order: 2, cause: 'writer' }),
];

const NOTHING_ASKED = { provider: null, model: null, effort: null };

const routing = (over: Partial<AutoRouting>): AutoRouting => ({
  provider: 'codex',
  model: 'gpt-6.1-sol',
  effort: 'medium',
  reason: 'Sol fits a standard step and Claude is at 62%.',
  proposal: 'kept',
  source: 'lead',
  candidates: CANDIDATES,
  requested: { provider: 'codex', model: 'gpt-6.1-sol', effort: 'medium' },
  modelReason: 'Sol fits a standard step and Claude is at 62%.',
  ...over,
});

describe('routingWhyOf', () => {
  it('says plainly when the asked model is not on the account', () => {
    const why = routingWhyOf({
      routing: routing({
        provider: 'anthropic',
        model: 'sonnet-5.5',
        source: 'fallback',
        proposal: 'replaced',
        cause: 'no-access',
        reason: 'Opus 5.5 is not on your Claude account, so this ran on Sonnet 5.5.',
        requested: { provider: 'anthropic', model: 'opus-5.5', effort: null },
      }),
    });

    expect(why).toMatchObject({
      whyLabel: 'Why Claude: ',
      why: 'Opus 5.5 is not on your Claude account, so this ran on Sonnet 5.5.',
      isMoved: true,
    });
  });

  it("names the provider and gives the Lead's own words for a Lead pick", () => {
    const why = routingWhyOf({ routing: routing({}) });

    expect(why).toMatchObject({
      providerLabel: 'Codex',
      whyLabel: 'Why the Lead chose Codex: ',
      why: 'Sol fits a standard step and Claude is at 62%.',
      leadSaid: null,
      isMoved: false,
    });
  });

  it("keeps the Lead's words on a continue that kept the agent's model", () => {
    expect(
      routingWhyOf({
        routing: routing({
          source: 'lock',
          reason: 'Kept the model of this agent.',
          candidates: [],
        }),
      }),
    ).toMatchObject({
      whyLabel: 'Why the Lead chose Codex: ',
      why: 'Sol fits a standard step and Claude is at 62%.',
      candidates: [],
    });
  });

  it('lists the candidates as stored, marks the pick and strikes the unusable rows', () => {
    const rows = routingWhyOf({ routing: routing({}) })?.candidates ?? [];

    expect(rows.map((candidate) => [candidate.providerLabel, candidate.facts])).toEqual([
      ['Claude', 'Claude is #1 in your order · 62% used · 3 agents in the last hour'],
      [
        'Cursor',
        'Cursor is #2 in your order · about 40% used, estimated · 1 agent in the last hour',
      ],
      ['Codex', 'Codex is #3 in your order · no usage reading · 0 agents in the last hour'],
      [
        'Cursor',
        'the Lead cannot stop Cursor from pushing on its own yet, so it gives Cursor only read-only jobs',
      ],
    ]);
    expect(rows.map((candidate) => candidate.isPick)).toEqual([false, false, true, false]);
    expect(rows.map((candidate) => candidate.isStruck)).toEqual([false, false, false, true]);
    expect(rows[0]?.modelLabel).toBe('Sonnet 5.5 · Medium');
  });

  it('reads a pick by the rule in its short form, without the provider twice', () => {
    expect(
      routingWhyOf({
        routing: routing({
          source: 'rule',
          reason: 'Codex: most room left',
          requested: NOTHING_ASKED,
        }),
      }),
    ).toMatchObject({ whyLabel: 'Why Codex: ', why: 'most room left', leadSaid: null });
    expect(
      routingWhyOf({
        routing: routing({
          provider: 'anthropic',
          model: 'haiku-5.5',
          source: 'rule',
          reason: 'Haiku 5.5: lighter, fits the step',
          requested: NOTHING_ASKED,
        }),
      }),
    ).toMatchObject({ whyLabel: 'Why Haiku 5.5: ', why: 'lighter, fits the step' });
  });

  it("says why the pick changed, keeps the Lead's line under it and marks what it asked for", () => {
    const why = routingWhyOf({
      routing: routing({
        provider: 'anthropic',
        model: 'sonnet-5.5',
        source: 'fallback',
        cause: 'writer',
        proposal: 'replaced',
        reason:
          'The Lead asked for Cursor Sonnet 5.5: the Lead cannot stop Cursor from pushing on its own yet, so it gives Cursor only read-only jobs. Claude: first in your order.',
        requested: { provider: 'cursor', model: 'sonnet-5.5', effort: 'medium' },
        modelReason: 'Cursor has room and Sonnet fits a standard test.',
      }),
    });

    expect(why).toMatchObject({
      whyLabel: 'Why Claude: ',
      why: 'The Lead asked for Cursor Sonnet 5.5: the Lead cannot stop Cursor from pushing on its own yet, so it gives Cursor only read-only jobs. Claude: first in your order.',
      leadSaid: 'Cursor has room and Sonnet fits a standard test.',
      isMoved: true,
    });
    const asked = why?.candidates.find((candidate) => candidate.isAsked);
    expect(asked).toMatchObject({
      providerLabel: 'Cursor',
      isStruck: true,
      facts:
        'asked by the Lead · the Lead cannot stop Cursor from pushing on its own yet, so it gives Cursor only read-only jobs',
    });
    expect(why?.candidates.filter((candidate) => candidate.isPick)).toHaveLength(1);
  });

  it('marks the effort variant the pick ran at, not the first row of its model', () => {
    const rows =
      routingWhyOf({
        routing: routing({
          effort: 'high',
          candidates: [
            row({ provider: 'codex', model: 'gpt-6.1-sol', effort: 'medium' }),
            row({ provider: 'codex', model: 'gpt-6.1-sol', effort: 'high' }),
          ],
        }),
      })?.candidates ?? [];

    expect(rows.map((candidate) => candidate.isPick)).toEqual([false, true]);
  });

  it('marks the row the Lead asked for when it named the model by an alias', () => {
    const why = routingWhyOf({
      routing: routing({
        provider: 'codex',
        model: 'gpt-6.1-sol',
        source: 'fallback',
        cause: 'writer',
        proposal: 'replaced',
        reason:
          'The Lead asked for Claude Sonnet 5.5: the Lead cannot stop Claude from pushing on its own yet, so it gives Claude only read-only jobs.',
        requested: { provider: 'anthropic', model: 'claude-sonnet-5-5', effort: 'medium' },
        candidates: [
          row({ provider: 'anthropic', model: 'sonnet-5.5', cause: 'writer' }),
          row({ provider: 'codex', model: 'gpt-6.1-sol' }),
        ],
      }),
    });

    expect(why?.candidates.map((candidate) => candidate.isAsked)).toEqual([true, false]);
  });

  it("says the effort changed when the app dropped the Lead's effort, and keeps its words apart", () => {
    const why = routingWhyOf({
      routing: routing({
        effort: 'medium',
        proposal: 'adjusted',
        reason: 'Sol fits a standard step and Claude is at 62%.',
        requested: { provider: 'codex', model: 'gpt-6.1-sol', effort: 'max' },
      }),
    });

    expect(why).toMatchObject({
      whyLabel: 'Why Codex: ',
      why: 'The Lead asked for GPT-6.1 Sol at Max effort, not offered here. It runs at Medium effort.',
      leadSaid: 'Sol fits a standard step and Claude is at 62%.',
      isMoved: true,
    });
  });

  it('gives nothing for an older delegation stored before the source was kept', () => {
    expect(
      routingWhyOf({
        routing: {
          provider: 'anthropic',
          model: 'sonnet-5.5',
          effort: 'medium',
          reason: 'chosen for the role',
          proposal: 'kept',
        },
      }),
    ).toBeNull();
    expect(routingWhyOf({ routing: null })).toBeNull();
    expect(routingWhyOf({ routing: { ...routing({}), source: 'manual' } })).toBeNull();
  });

  it('reads an unknown cause as plain words and skips a row it cannot name', () => {
    const why = routingWhyOf({
      routing: {
        ...routing({}),
        candidates: [
          { provider: 'codex', model: 'gpt-6.1-sol', cause: 'constructor' },
          { provider: 7, model: null },
          'text',
        ],
      },
    });

    expect(why?.candidates.map((candidate) => candidate.facts)).toEqual([
      'not a candidate for this step',
    ]);
  });

  it('shows no candidates when none were stored, and a lighter row says so', () => {
    const bare = { provider: 'codex', model: 'gpt-6.1-sol', reason: 'Codex: x', source: 'rule' };
    expect(routingWhyOf({ routing: bare })?.candidates).toEqual([]);
    const lighter = routingWhyOf({
      routing: routing({ candidates: [row({ model: 'haiku-5.5', isLighter: true })] }),
    });
    expect(lighter?.candidates[0]?.facts).toBe(
      'Claude is #1 in your order · 62% used · 3 agents in the last hour · lighter model',
    );
  });
});
