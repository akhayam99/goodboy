import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { STATE_WORD_MEANINGS } from '../../shared/utils/testing/stateWordMeanings';
import { AGENT_STATUS_PRESENTATION } from '../../features/session/agent-status';
import { glanceOf, type GlanceState } from '../../features/session/glance/glanceOf';
import { describeCopy, scanCopy } from './scanCopy';

const STATES: ReadonlyArray<GlanceState> = [
  'waiting',
  'running',
  'queued',
  'ready',
  'paused',
  'failed',
  'stopping',
  'stopped',
  'done',
  'idle',
  'skipped',
];
const RETIRED = /^(?:Stuck|Blocked|Working|Planning|Pending)$/i;
const STATE_PROPS: ReadonlySet<string> = new Set(['word', 'short', 'phrase']);
const WORK_ROOT =
  /^(?:features\/(?:session|auto|workflows|workTreeModel|live-state)\/|app\/components\/SpawnedPanel\/)/;
const MEANING_BY_WORD: ReadonlyMap<string, string> = new Map(
  STATE_WORD_MEANINGS.map((entry) => [entry.word, entry.meaning]),
);

describe('one table of state words and meanings', () => {
  it('keeps the meanings equal to the table in concepts', () => {
    const concepts = readFileSync(join(__dirname, '../../../../../docs/concepts.md'), 'utf8');
    const lines = concepts.split('\n');
    const start = lines.findIndex((line) => line.replace(/\s/g, '') === '|Stateword|Meaning|');
    expect(start).toBeGreaterThanOrEqual(0);
    const rows =
      lines
        .slice(start + 2)
        .join('\n')
        .split('\n\n')[0]
        ?.split('\n') ?? [];
    const documented = rows.map((line) => {
      const cells = line.split('|').map((cell) => cell.trim());
      return { word: cells[1], meaning: cells[2] };
    });

    expect(documented).toEqual(STATE_WORD_MEANINGS);
    expect(MEANING_BY_WORD.size).toBe(STATE_WORD_MEANINGS.length);
  });

  it('keeps the glance, live group and agent state maps in the table', () => {
    const words = [
      ...STATES.map((state) => glanceOf({ state, sentence: '' }).word),
      ...Object.values(AGENT_STATUS_PRESENTATION).map(({ label }) => label),
    ];

    expect(words.filter((word) => !MEANING_BY_WORD.has(word))).toEqual([]);
  });

  it('rejects retired words in work state properties', () => {
    const offenders = scanCopy()
      .filter(
        (copy) =>
          WORK_ROOT.test(copy.path) &&
          copy.prop !== null &&
          STATE_PROPS.has(copy.prop) &&
          RETIRED.test(copy.text),
      )
      .map((copy) => describeCopy({ copy }));

    expect(offenders).toEqual([]);
  });
});
