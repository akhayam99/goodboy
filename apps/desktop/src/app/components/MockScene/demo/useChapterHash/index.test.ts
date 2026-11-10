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

  it('replaces an unknown hash with the group shown, with no new history entry', () => {
    window.history.replaceState(null, '', '/?scene=demo#nope');
    const before = window.history.length;
    const { result } = renderHash();
    expect(result.current.chapterId).toBe('bring');
    expect(window.location.hash).toBe('#bring');
    expect(window.location.search).toBe('?scene=demo');
    expect(window.history.length).toBe(before);
  });

  it('keeps the group shown when an unknown hash is typed while the demo is open', () => {
    const { result } = renderHash();
    act(() => result.current.selectChapter({ id: 'guide' }));
    const before = window.history.length;
    act(() => {
      window.history.replaceState(null, '', '/?scene=demo#nope');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current.chapterId).toBe('guide');
    expect(window.location.hash).toBe('#guide');
    expect(window.history.length).toBe(before);
  });

  it('leaves an empty hash alone', () => {
    window.history.replaceState(null, '', '/?scene=demo');
    renderHash();
    expect(window.location.hash).toBe('');
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
