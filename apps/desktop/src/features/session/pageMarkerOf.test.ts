// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pageMarkerOf } from './pageMarkerOf';

describe('pageMarkerOf', () => {
  it('marks Auto agents Experimental and says what that means', () => {
    const marker = pageMarkerOf({ pageId: 'auto' });

    expect(marker?.label).toBe('Experimental');
    expect(marker?.why).toBe('Auto starts agents on its own. Its choices are still being tuned.');
  });

  it.each(['overview', 'runs', 'orchestrated', 'agents', 'artifacts', 'questions'] as const)(
    'leaves %s unmarked',
    (pageId) => {
      expect(pageMarkerOf({ pageId })).toBeNull();
    },
  );
});
