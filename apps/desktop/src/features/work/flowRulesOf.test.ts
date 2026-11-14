import { describe, expect, it } from 'vitest';
import { flowRulesOf, type FlowRules } from './flowRulesOf';
import { flowWordOf } from '../../shared/lib/flowWordOf';

type Row = readonly [name: string, key: keyof FlowRules, off: unknown, on: unknown];

const MATRIX: ReadonlyArray<Row> = [
  ['sidebar', 'hasWorkSection', false, true],
  ['the word', 'word', 'Auto', 'Lead'],
  ['start target', 'shouldStartOpenComposer', false, true],
  ['start label', 'startLabel', 'Start a run', 'Start work'],
  ['autonomy control', 'autonomyControl', 'level-chip', 'rows-panel'],
  ['permission rows', 'hasPermissionRows', false, true],
  ['a message while agents work', 'isMessageDeliveredAtOnce', false, true],
  ['the Lead closes its own work', 'canLeadCloseItsWork', false, true],
  ['a saved place on Work', 'savedPlaceOnWork', 'board', 'work'],
];

describe('flowRulesOf', () => {
  it.each(MATRIX)('%s, switch off', (_name, key, off) => {
    expect(flowRulesOf({ isWork: false })[key]).toBe(off);
  });

  it.each(MATRIX)('%s, switch on', (_name, key, _off, on) => {
    expect(flowRulesOf({ isWork: true })[key]).toBe(on);
  });

  it('takes the word from flowWordOf in both positions', () => {
    expect(flowRulesOf({ isWork: false }).word).toBe(flowWordOf({ isWork: false }));
    expect(flowRulesOf({ isWork: true }).word).toBe(flowWordOf({ isWork: true }));
  });
});
