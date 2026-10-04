// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { LENS_LABEL } from '../../features/session/lens-labels';
import { AGENT_KIND_META, ROLE_LABEL } from '../../features/session/agent-kind';
import { ACTIVITY_VIEW_LABEL } from '../../features/session/timeline/activityView';
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
  ACTIVITY_VIEW_LABEL: Object.values(ACTIVITY_VIEW_LABEL),
  ROW_NODE_LABEL: Object.values(ROW_NODE_LABEL),
};

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
