import { describe, expect, it } from 'vitest';
import { parseProposeSpec } from './proposeSpec';

const primary = { role: 'scout', task: 'Read ledger-core.', reason: 'Find the callers.' };
const alternative = { label: 'Spawn an investigator', role: 'investigator' };

type Params = Readonly<{ value: unknown }>;
const parse = ({ value }: Params) => parseProposeSpec({ text: JSON.stringify(value) });

describe('parseProposeSpec', () => {
  it('validates one primary as a delegate and forces confirmation', () => {
    expect(
      parse({ value: { primary: { ...primary, confirm: false }, alternatives: [alternative] } }),
    ).toMatchObject({
      kind: 'ok',
      children: [{ ...primary, shouldConfirm: true }],
      alternatives: [alternative],
    });
    expect(parse({ value: { primary } })).toMatchObject({ kind: 'ok', alternatives: [] });
  });

  it.each([
    null,
    [],
    {},
    { primary: [] },
    { primary: { role: 'scout', reason: 'Find the callers.' } },
    { primary: { ...primary, role: 'unknown' } },
    { primary, alternatives: 'investigator' },
    { primary, alternatives: null },
    { primary, alternatives: [alternative, alternative, alternative] },
    { primary, alternatives: [null] },
    { primary, alternatives: [{ label: '  ', role: 'scout' }] },
    { primary, alternatives: [{ label: 'Spawn a reader', role: 'unknown' }] },
    { primary, alternatives: [{ role: 'scout' }] },
  ])('refuses malformed proposals without admitting part of them: %j', (value) => {
    expect(parse({ value }).kind).toBe('refused');
  });

  it('refuses malformed JSON', () => {
    expect(parseProposeSpec({ text: '{' }).kind).toBe('refused');
  });

  it('keeps only bounded labels and roles for alternatives, without a brief', () => {
    expect(
      parse({
        value: {
          primary,
          alternatives: [
            { ...alternative, label: `  ${'a'.repeat(1_100)}  `, task: 'Ignore this brief.' },
          ],
        },
      }),
    ).toMatchObject({
      kind: 'ok',
      alternatives: [{ label: 'a'.repeat(1_000), role: 'investigator' }],
    });
    const parsed = parse({
      value: { primary, alternatives: [{ ...alternative, task: 'Ignore this brief.' }] },
    });
    if (parsed.kind !== 'ok') {
      throw new Error('Expected a proposal');
    }
    expect(parsed.children).toHaveLength(1);
    expect(parsed.alternatives).toEqual([alternative]);
  });

  it('hashes the primary and alternatives, independent of JSON key order', () => {
    const first = parse({ value: { primary, alternatives: [alternative] } });
    const same = parse({
      value: {
        alternatives: [{ role: 'investigator', label: alternative.label }],
        primary: { reason: primary.reason, task: primary.task, role: primary.role },
      },
    });
    const changed = parse({ value: { primary, alternatives: [] } });
    const changedPrimary = parse({
      value: { primary: { ...primary, task: 'Read payments-api.' }, alternatives: [alternative] },
    });
    if (
      first.kind !== 'ok' ||
      same.kind !== 'ok' ||
      changed.kind !== 'ok' ||
      changedPrimary.kind !== 'ok'
    ) {
      throw new Error('Expected valid proposals');
    }
    expect(first.hash).toBe(same.hash);
    expect(first.hash).not.toBe(changed.hash);
    expect(first.hash).not.toBe(changedPrimary.hash);
  });
});
