import { describe, expect, it } from 'vitest';
import { extractJson } from './extract-json';

const parse = (raw: string): unknown => JSON.parse(extractJson({ raw }));

describe('extractJson', () => {
  it('returns a clean JSON object untouched', () => {
    const raw = '{"upserts":[{"key":"goal","value":"ship the parser fix"}]}';

    expect(parse(raw)).toEqual({ upserts: [{ key: 'goal', value: 'ship the parser fix' }] });
  });

  it('unwraps an outer markdown fence around the JSON', () => {
    const raw = '```json\n{"upserts":[{"key":"goal","value":"ship it"}]}\n```';

    expect(parse(raw)).toEqual({ upserts: [{ key: 'goal', value: 'ship it' }] });
  });

  it('keeps the JSON when a slot value itself contains a markdown fence', () => {
    const value = '**State:**\n\n```typescript\nconst a = 1;\n```\n';
    const raw = JSON.stringify({ upserts: [{ key: 'last_output_summary', value }] });

    expect(parse(raw)).toEqual({ upserts: [{ key: 'last_output_summary', value }] });
  });

  it('keeps the JSON when a fenced bash block follows it inside the value', () => {
    const value = 'run:\n\n```bash\npnpm test\n```';
    const raw = `Here is the update:\n${JSON.stringify({ upserts: [{ key: 'decisions', value }] })}`;

    expect(parse(raw)).toEqual({ upserts: [{ key: 'decisions', value }] });
  });

  it('returns prose unchanged so the caller can reject it', () => {
    expect(extractJson({ raw: '  Nothing changed this turn.  ' })).toBe(
      'Nothing changed this turn.',
    );
  });

  it('returns an empty string for an empty reply', () => {
    expect(extractJson({ raw: '   \n  ' })).toBe('');
  });

  it.each([
    ['a fenced json block at the edges', '```json\n{"a":1}\n```', '{"a":1}'],
    ['an uppercase JSON tag', '```JSON\n{"a":1}\n```', '{"a":1}'],
    ['a mixed case tag with mixed whitespace', '```Json  \t\n  [true]  \n\t```', '[true]'],
    ['a fence with no tag', '```\n{"a":1}\n```', '{"a":1}'],
    [
      'a fence in the middle of prose',
      'Here is the plan:\n```json\n[1, 2]\n```\nThanks.',
      '[1, 2]',
    ],
    ['a non json tag in prose', 'see ```yaml\nkey: 1\n``` then', 'yaml\nkey: 1'],
    ['an empty json fence', '```json\n```', '```json\n```'],
    ['an empty fence', '```\n\n```', '```\n\n```'],
    ['text with no fence', 'Nothing changed this turn.', 'Nothing changed this turn.'],
  ])('matches the old fence regex for %s', (_label, raw, expected) => {
    expect(extractJson({ raw })).toBe(expected);
  });

  it.each([
    ['tabs after an open fence', `\`\`\`${'\t'.repeat(100_000)}`],
    ['tabs before trailing text', `\`\`\`${'\t'.repeat(100_000)}x`],
    ['a json tag and spaces before trailing text', `\`\`\`json${' '.repeat(100_000)}x`],
  ])('returns fast on %s with no closing fence', (_label, raw) => {
    const startedAt = performance.now();
    const result = extractJson({ raw });
    const elapsed = performance.now() - startedAt;

    expect(result).toBe(raw.trim());
    expect(elapsed).toBeLessThan(50);
  });
});
