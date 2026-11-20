// @vitest-environment node
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { LENS_LABEL } from '../../features/session/lens-labels';
import { AGENT_KIND_META, ROLE_LABEL } from '../../features/session/agent-kind';
import { SESSION_PAGE_INTRO } from '../../features/session/sessionPageIntro';
import { ROW_NODE_LABEL } from '../../features/workTreeModel/rowStateCopy';
import baseline from './jargon-copy.baseline.json';
import { describeCopy, scanCopy } from './scanCopy';

const JARGON =
  /(?<![\w-])(clusters?|lens(?:es)?|(?:un)?mount(?:s|ed|ing)?|spawn(?:s|ed|ing)?|studios?|handoffs?|materiali[sz](?:e|es|ed|ing))(?![\w-])/i;

type BaselineEntry = {
  readonly count: number;
  readonly reason: string;
};

const BASELINE: Readonly<Record<string, BaselineEntry>> = baseline;

const found = scanCopy()
  .filter((copy) => JARGON.test(copy.text))
  .reduce<Record<string, Array<string>>>((byPath, copy) => {
    byPath[copy.path] = [...(byPath[copy.path] ?? []), describeCopy({ copy })];
    return byPath;
  }, {});

const NAMED_COPY: Readonly<Record<string, ReadonlyArray<string>>> = {
  LENS_LABEL: Object.values(LENS_LABEL),
  ROLE_LABEL: Object.values(ROLE_LABEL),
  AGENT_KIND_META: Object.values(AGENT_KIND_META).flatMap((meta) => [meta.label, meta.hint]),
  ROW_NODE_LABEL: Object.values(ROW_NODE_LABEL),
  SESSION_PAGE_INTRO: Object.values(SESSION_PAGE_INTRO).flat(),
};

const LOWERCASE_BRAND = /(?<![\w./:@-])goodboy(?![\w./:@-])/;

describe('on-screen copy writes the product name with its capital', () => {
  it.each(['so goodboy stopped it', 'before goodboy started keeping'])('flags %s', (text) => {
    expect(LOWERCASE_BRAND.test(text)).toBe(true);
  });

  it.each([
    'Goodboy stopped it',
    'the ~/.goodboy folder',
    'goodboy:open-settings',
    'a goodboy-ai.dev link',
  ])('leaves %s alone', (text) => {
    expect(LOWERCASE_BRAND.test(text)).toBe(false);
  });

  it('has no goodboy in lowercase outside a code span', () => {
    const offenders = scanCopy()
      .filter((copy) => LOWERCASE_BRAND.test(copy.text.replace(/`[^`]*`/g, '')))
      .map((copy) => describeCopy({ copy }));

    expect(offenders).toEqual([]);
  });
});

describe('on-screen copy says no internal word', () => {
  it('keeps every named copy map free of internal words', () => {
    const offenders = Object.entries(NAMED_COPY).flatMap(([map, values]) =>
      values.filter((value) => JARGON.test(value)).map((value) => `${map}: ${value}`),
    );

    expect(offenders).toEqual([]);
  });

  it('adds no internal word to rendered copy outside the baseline', () => {
    const offenders = Object.entries(found).flatMap(([path, lines]) => {
      const allowed = BASELINE[path]?.count ?? 0;
      return lines.length > allowed ? lines : [];
    });

    expect(offenders).toEqual([]);
  });

  it.runIf(process.env.RATCHET_CLOSE === '1')(
    'shrinks the baseline when an exception goes away',
    () => {
      const stale = Object.entries(BASELINE).flatMap(([path, entry]) => {
        const count = found[path]?.length ?? 0;
        return count < entry.count ? [`${path}: baseline ${entry.count}, found ${count}`] : [];
      });

      expect(stale).toEqual([]);
    },
  );
});

const PANEL_JARGON = /(?<![\w-])(columns?|lanes?|grids?|tiers?|drawers?)(?![\w-])/i;
const PANEL_BASELINE_PATH = join(__dirname, 'jargon-panel-copy.baseline.json');

type PanelCopyParams = {
  readonly prop: string | null;
  readonly text: string;
};

const isPanelJargon = ({ prop, text }: PanelCopyParams): boolean =>
  (prop !== null || /[A-Z]/.test(text)) && PANEL_JARGON.test(text);

describe('on-screen copy says panel, never the layout word', () => {
  const measured = scanCopy()
    .filter(isPanelJargon)
    .reduce<Record<string, number>>((byPath, copy) => {
      byPath[copy.path] = (byPath[copy.path] ?? 0) + 1;
      return byPath;
    }, {});

  if (process.env.GOODBOY_UPDATE_BASELINE === '1') {
    writeFileSync(
      PANEL_BASELINE_PATH,
      `${JSON.stringify(Object.fromEntries(Object.entries(measured).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`,
    );
  }

  it.each(['Close the drawer', 'Board columns', 'Each session sits in a lane', 'Reader tier'])(
    'flags %s',
    (text) => {
      expect(isPanelJargon({ prop: 'label', text })).toBe(true);
    },
  );

  it.each([
    ['label', 'Close the panel'],
    [null, 'grid grid-cols-2 gap-3'],
    ['label', 'Reset panel layout'],
  ])('leaves %s %s alone', (prop, text) => {
    expect(isPanelJargon({ prop, text })).toBe(false);
  });

  it('adds no column, lane, grid, tier or drawer to rendered copy outside the baseline', () => {
    const baseline: Readonly<Record<string, number>> = JSON.parse(
      readFileSync(PANEL_BASELINE_PATH, 'utf8'),
    );
    const grown = Object.entries(measured).flatMap(([path, count]) =>
      count > (baseline[path] ?? 0) ? [`${path}: ${count} (baseline ${baseline[path] ?? 0})`] : [],
    );

    expect(grown).toEqual([]);
  });
});
