import { describe, expect, it } from 'vitest';
import { codeFenceMarkers } from './codeFenceMarkers';

describe('codeFenceMarkers', () => {
  it('wraps a marker carrying attributes in a code span', () => {
    expect(codeFenceMarkers({ text: 'emit <<step-done id="s1">> when finished' })).toBe(
      'emit `<<step-done id="s1">>` when finished',
    );
  });

  it('wraps a closing marker too', () => {
    expect(codeFenceMarkers({ text: '<<plan>>body<</plan>>' })).toBe('`<<plan>>`body`<</plan>>`');
  });

  it('leaves a marker that is already fenced alone', () => {
    expect(codeFenceMarkers({ text: 'emit `<<step-done>>` now' })).toBe('emit `<<step-done>>` now');
  });

  it('leaves text without markers untouched', () => {
    expect(codeFenceMarkers({ text: 'scope this step only' })).toBe('scope this step only');
  });
});
