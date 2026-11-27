// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import { AGENT_KIND_PALETTE } from '../../features/session/agent-kind';

type Twin = {
  readonly owners: ReadonlyArray<string>;
  readonly reason: string;
};

const KIND_OF_CONCEPT: Readonly<Record<string, string>> = {
  auto: 'auto',
  history: 'rewriter',
  report: 'report',
  resolve: 'resolver',
  wireframe: 'wireframe',
};

const TWINS: ReadonlyArray<Twin> = [
  {
    owners: ['concept:ask', 'concept:comments', 'concept:message'],
    reason: 'a word to an agent and a comment are both a speech bubble',
  },
  {
    owners: ['concept:plan', 'concept:plans'],
    reason: 'one clipboard, two tones: a plan and the plans page',
  },
  {
    owners: ['concept:pr', 'kind:pr-reviewer'],
    reason: 'GitHub shows the pull request glyph on a review request',
  },
  {
    owners: ['concept:connections', 'concept:integrations'],
    reason: 'the same area of the app: the plug',
  },
  {
    owners: ['concept:autoRouting', 'concept:runs'],
    reason: 'documented: Fork is the GitHub repo fork, and routing never shares a row with runs',
  },
  {
    owners: ['concept:reportIssue', 'kind:debugger'],
    reason: 'both mean bug and never share a row',
  },
  {
    owners: ['concept:auto', 'concept:orchestrator'],
    reason: 'the Lead replaced the orchestrator: two keys, one glyph',
  },
  {
    owners: ['concept:agents', 'kind:generic'],
    reason: 'a kind the app does not know falls back to the agent glyph',
  },
  {
    owners: ['concept:editor', 'kind:implementer'],
    reason: 'both are a code bracket pair',
  },
  {
    owners: ['concept:learning', 'kind:docs'],
    reason: 'both are an open book: what was explained and the docs agent',
  },
  {
    owners: ['concept:skills', 'kind:ci-fixer'],
    reason: 'both are a wrench',
  },
];

const ownersByGlyph = (): ReadonlyArray<ReadonlyArray<string>> => {
  const byGlyph = new Map<unknown, string[]>();
  const add = (glyph: unknown, name: string) => {
    byGlyph.set(glyph, [...(byGlyph.get(glyph) ?? []), name]);
  };
  Object.entries(CONCEPT_ICONS).forEach(([concept, glyph]) => add(glyph, `concept:${concept}`));
  const reused = new Set(Object.values(KIND_OF_CONCEPT));
  Object.entries(AGENT_KIND_PALETTE).forEach(([kind, entry]) => {
    if (!reused.has(kind)) {
      add(entry.icon, `kind:${kind}`);
    }
  });
  return [...byGlyph.values()].map((owners) => [...owners].sort());
};

const keyOf = (owners: ReadonlyArray<string>): string => [...owners].sort().join(' + ');

describe('one glyph per concept', () => {
  it('fails when two concepts share a glyph without a written reason', () => {
    const allowed = new Set(TWINS.map((twin) => keyOf(twin.owners)));
    const unwritten = ownersByGlyph()
      .filter((owners) => owners.length > 1)
      .map(keyOf)
      .filter((key) => !allowed.has(key));
    expect(unwritten).toEqual([]);
  });

  it('keeps every reused agent kind on the glyph of its concept', () => {
    const drifted = Object.entries(KIND_OF_CONCEPT)
      .filter(([concept, kind]) => {
        const palette: Readonly<Record<string, { readonly icon: unknown }>> = AGENT_KIND_PALETTE;
        const glyphs: Readonly<Record<string, unknown>> = CONCEPT_ICONS;
        return palette[kind]?.icon !== glyphs[concept];
      })
      .map(([concept, kind]) => `kind:${kind} no longer draws concept:${concept}`);
    expect(drifted).toEqual([]);
  });

  it('drops an allowlist entry the moment its twins stop sharing a glyph', () => {
    const shared = new Set(
      ownersByGlyph()
        .filter((owners) => owners.length > 1)
        .map(keyOf),
    );
    const stale = TWINS.map((twin) => keyOf(twin.owners)).filter((key) => !shared.has(key));
    expect(stale).toEqual([]);
  });

  it('gives every allowlist entry a reason', () => {
    expect(TWINS.filter((twin) => twin.reason.length === 0)).toEqual([]);
  });
});
