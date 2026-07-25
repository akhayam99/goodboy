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
});
