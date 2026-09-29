// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pageOfPath, screenPagePath } from './wireframePagePath';

describe('wireframe page paths', () => {
  it('names one page per screen and one per state', () => {
    expect(screenPagePath({ screenId: 'review-batch', state: null })).toBe(
      'screens/review-batch.html',
    );
    expect(screenPagePath({ screenId: 'review-batch', state: 'empty' })).toBe(
      'screens/review-batch--empty.html',
    );
  });

  it('reads the screen and the state back from a page path', () => {
    expect(pageOfPath({ path: 'screens/review-batch.html' })).toEqual({
      screenId: 'review-batch',
      state: null,
    });
    expect(pageOfPath({ path: 'screens/review-batch--error.html' })).toEqual({
      screenId: 'review-batch',
      state: 'error',
    });
    expect(pageOfPath({ path: 'index.html' })).toBeNull();
    expect(pageOfPath({ path: 'screens/a/b.html' })).toBeNull();
  });
});
