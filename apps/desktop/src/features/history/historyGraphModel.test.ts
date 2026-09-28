import { describe, expect, it } from 'vitest';
import { historyGraphModel, rewrittenFrom } from './historyGraphModel';
import { initialPlanItems, setVerb } from './historyPlan';
import { LEDGER, LEDGER_COMMITS, LEDGER_GRAPH, LEDGER_ORIGINAL } from './testing/ledgerFixture';
import { LEDGER_PRESET } from './testing/ledgerPreset';

const base = initialPlanItems({ commits: LEDGER_COMMITS });
const model = (items: typeof base, onto: string | null = null) =>
  historyGraphModel({
    commits: LEDGER_COMMITS,
    items,
    original: LEDGER_ORIGINAL,
    onto,
    graph: LEDGER_GRAPH,
    prHeadSha: LEDGER.c,
  });

describe('history graph model', () => {
  it('places you are here, the online copy and the pull request on their rows', () => {
    const now = model(base);
    expect(now.headSha).toBe(LEDGER.f);
    expect(now.remoteRowSha).toBe(LEDGER.c);
    expect(now.prRowSha).toBe(LEDGER.c);
    expect(now.onlineCount).toBe(3);
    expect(now.behind).toBe(3);
  });

  it('rewrites nothing and touches nothing online while the plan is untouched', () => {
    const now = model(base);
    expect(now.rewritten.size).toBe(0);
    expect(now.touchedOnline).toBe(0);
    expect(now.afterCount).toBe(7);
  });

  it('rewrites from the first change up, so a local change leaves online commits alone', () => {
    const local = model(setVerb({ items: base, sha: LEDGER.x, verb: 'drop' }));
    expect(local.touchedOnline).toBe(0);
    expect(local.rewritten.has(LEDGER.x)).toBe(true);
    expect(local.rewritten.has(LEDGER.d)).toBe(false);
  });

  it('counts the online commits the preset replaces and how many commits stay', () => {
    const planned = model(LEDGER_PRESET);
    expect(planned.touchedOnline).toBe(3);
    expect(planned.afterCount).toBe(4);
    expect(rewrittenFrom({ items: LEDGER_PRESET, original: LEDGER_ORIGINAL, onto: null })).toBe(0);
  });

  it('rewrites everything and closes the gap to main when starting from today main', () => {
    const rebased = model(base, LEDGER_GRAPH.mainHead);
    expect(rebased.touchedOnline).toBe(3);
    expect(rebased.behind).toBe(0);
  });
});
