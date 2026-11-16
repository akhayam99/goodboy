// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseSummaryDocument } from '@goodboy/core/context';
import { summaryStatusOf } from './summaryStatusOf';

type Params = { readonly text: string };

const statusOf = ({ text }: Params) =>
  summaryStatusOf({ document: parseSummaryDocument({ text }) });

describe('summaryStatusOf', () => {
  it('calls the run blocked and lifts the blocker out of the state as its own row', () => {
    const text = [
      '#### State',
      '- Dedupe check is live in payments-api',
      '- Backfill is written and stays read only',
      '- Blocked: notify-relay cannot show a stuck delivery until `delivery_state_v2` is on',
      '',
      '#### Next',
      '- Ask the Northwind team to turn the flag on',
    ].join('\n');

    expect(statusOf({ text })).toEqual({
      tone: 'blocked',
      line: 'Dedupe check is live in payments-api',
      blockers: ['notify-relay cannot show a stuck delivery until `delivery_state_v2` is on'],
      facts: ['Backfill is written and stays read only'],
      stepCount: 1,
    });
  });

  it('reads a run with steps left and no blocker as working', () => {
    const text = ['#### State', '- 42 tests pass', '', '#### Next', '- Wire notify-relay'].join(
      '\n',
    );

    expect(statusOf({ text })?.tone).toBe('working');
  });

  it('reads a run with no step left as done, whatever its state says', () => {
    expect(statusOf({ text: '#### State\n- Shipped behind the flag' })?.tone).toBe('done');
    const saysDone = ['#### State', '- Done', '', '#### Next', '- Watch a week of traffic'].join(
      '\n',
    );
    expect(statusOf({ text: saysDone })).toMatchObject({ tone: 'working', stepCount: 1 });
  });

  it('keeps every state item: line, blockers and facts hold all of them', () => {
    const text = [
      '#### State',
      'Waiting on ledger-core for the schema. The dedupe check is live. Stuck on review.',
      'The backfill stays read only.',
    ].join('\n');
    const status = statusOf({ text });

    expect(status?.line).toBe('The dedupe check is live.');
    expect(status?.blockers).toEqual([
      'Waiting on ledger-core for the schema.',
      'Stuck on review.',
    ]);
    expect(status?.facts).toEqual(['The backfill stays read only.']);
  });

  it('has no status without a State section or with an empty one', () => {
    expect(statusOf({ text: '' })).toBeNull();
    expect(statusOf({ text: '#### Next\n- later' })).toBeNull();
    expect(statusOf({ text: '#### State\n\n#### Next\n- later' })).toBeNull();
  });

  it('keeps a blocker whole when it is only the label', () => {
    expect(statusOf({ text: '#### State\n- Blocked:' })?.blockers).toEqual(['Blocked:']);
  });
});
