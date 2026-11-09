// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useChapterHash } from './index';

const IDS: ReadonlyArray<string> = ['bring', 'direction', 'guide', 'ship', 'get'];

const renderHash = () => renderHook(() => useChapterHash({ ids: IDS, fallbackId: 'bring' }));

beforeEach(() => {
  window.history.replaceState(null, '', '/?scene=demo#bring');
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('useChapterHash', () => {
  it('adds a history entry for every group the visitor picks, so Back stays in the demo', () => {
    const { result } = renderHash();
    const before = window.history.length;
    act(() => result.current.selectChapter({ id: 'direction' }));
    act(() => result.current.selectChapter({ id: 'guide' }));
    expect(window.history.length).toBe(before + 2);
    expect(window.location.hash).toBe('#guide');
    expect(result.current.chapterId).toBe('guide');
  });

  it('rewrites the entry in place for a redirect away from a locked group', () => {
    const { result } = renderHash();
    const before = window.history.length;
    act(() => result.current.selectChapter({ id: 'direction', isRedirect: true }));
    expect(window.history.length).toBe(before);
    expect(window.location.hash).toBe('#direction');
  });

  it('adds no entry when the visitor picks the group already open', () => {
    const { result } = renderHash();
    const before = window.history.length;
    act(() => result.current.selectChapter({ id: 'bring' }));
    expect(window.history.length).toBe(before);
  });

  it('follows the hash when the visitor goes back', () => {
    const { result } = renderHash();
    act(() => result.current.selectChapter({ id: 'direction' }));
    act(() => {
      window.history.replaceState(null, '', '/?scene=demo#bring');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current.chapterId).toBe('bring');
  });
});
