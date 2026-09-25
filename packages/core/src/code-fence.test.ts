import { describe, expect, it } from 'vitest';
import { unwrapEdgeFence } from './code-fence';

describe('unwrapEdgeFence', () => {
  it('unwraps a json, JSON or bare fence around the whole text', () => {
    expect(unwrapEdgeFence({ text: '```json\n{"a":1}\n```' })).toBe('{"a":1}');
    expect(unwrapEdgeFence({ text: '```JSON {"a":1} ```' })).toBe('{"a":1}');
    expect(unwrapEdgeFence({ text: '```\n{"a":1}\n```' })).toBe('{"a":1}');
  });

  it('leaves text without an edge fence alone', () => {
    expect(unwrapEdgeFence({ text: 'Here:\n```json\n{}\n```' })).toBe('Here:\n```json\n{}\n```');
    expect(unwrapEdgeFence({ text: '```' })).toBe('```');
  });

  it('answers quickly on a long run of tabs after an opening fence', () => {
    const started = performance.now();
    unwrapEdgeFence({ text: `\`\`\`${'\t'.repeat(50_000)}x` });
    expect(performance.now() - started).toBeLessThan(200);
  });
});
