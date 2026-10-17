// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pageMarkerOf } from './pageMarkerOf';

describe('pageMarkerOf', () => {
  it('marks Auto agents Experimental and says why', () => {
    const marker = pageMarkerOf({ pageId: 'auto', isAutoShown: true });

    expect(marker?.label).toBe('Experimental');
    expect(marker?.why).toBe(
      'Auto picks and starts agents on its own, under a limit. Its choices are still being tuned.',
    );
  });

  it('marks Agents Deprecated and points to Start an auto while Auto is shown', () => {
    const marker = pageMarkerOf({ pageId: 'agents', isAutoShown: true });

    expect(marker?.label).toBe('Deprecated');
    expect(marker?.why).toBe(
      'Use Start an auto: Auto picks and starts the right agent. Agents you start by hand keep working.',
    );
  });

  it('leaves Agents unmarked when the build has no Auto to point to', () => {
    expect(pageMarkerOf({ pageId: 'agents', isAutoShown: false })).toBeNull();
  });

  it.each(['overview', 'runs', 'orchestrated', 'artifacts', 'questions'] as const)(
    'leaves %s unmarked',
    (pageId) => {
      expect(pageMarkerOf({ pageId, isAutoShown: true })).toBeNull();
    },
  );
});
