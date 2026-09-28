import { describe, expect, it } from 'vitest';
import { excerptOf } from './excerptOf';

describe('excerptOf', () => {
  it('reads markdown as one plain line', () => {
    expect(
      excerptOf({
        markdown:
          '## Steps\n\n1. Page the query with a **keyset** cursor.\n- Keep the [old endpoint](https://example.test) behind a flag.',
      }),
    ).toBe('Steps Page the query with a keyset cursor. Keep the old endpoint behind a flag.');
  });

  it('cuts a long body at the limit with an ellipsis', () => {
    expect(excerptOf({ markdown: 'word '.repeat(100), limit: 20 })).toBe('word word word word…');
  });
});
