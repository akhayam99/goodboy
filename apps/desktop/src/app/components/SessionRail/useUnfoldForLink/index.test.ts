// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { brandId, type SessionId } from '@goodboy/types';
import { linkIssueEventName } from '../../../../features/actions/kinds/session';
import { useUnfoldForLink } from './index';

const SESSION_ID = brandId<SessionId>({ value: 'sess-1' });
const OTHER_ID = brandId<SessionId>({ value: 'sess-2' });
const NAME = linkIssueEventName({ sessionId: SESSION_ID });

type RenderParams = {
  readonly isFolded: boolean;
};

const renderUnfold = ({ isFolded }: RenderParams) => {
  const toggle = vi.fn();
  const view = renderHook((props) => useUnfoldForLink({ sessionId: SESSION_ID, fold: props }), {
    initialProps: { isFolded, toggle },
  });
  return { toggle, view };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useUnfoldForLink', () => {
  it('unfolds a folded rail once, then asks again with the same detail', () => {
    const heard = vi.fn();
    window.addEventListener(NAME, heard);
    const { toggle } = renderUnfold({ isFolded: true });

    act(() => {
      window.dispatchEvent(new CustomEvent(NAME, { detail: { source: 'jira' } }));
    });
    expect(toggle).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(heard).toHaveBeenCalledTimes(2);
    expect(heard.mock.calls[1]?.[0]).toMatchObject({ detail: { source: 'jira' } });
    expect(toggle).toHaveBeenCalledTimes(1);
    window.removeEventListener(NAME, heard);
  });

  it('leaves an open rail alone', () => {
    const { toggle } = renderUnfold({ isFolded: false });

    act(() => {
      window.dispatchEvent(new CustomEvent(NAME));
      vi.advanceTimersByTime(100);
    });
    expect(toggle).not.toHaveBeenCalled();
  });

  it('stops listening once the rail is open, and ignores another session', () => {
    const { toggle, view } = renderUnfold({ isFolded: true });

    act(() => {
      window.dispatchEvent(new CustomEvent(linkIssueEventName({ sessionId: OTHER_ID })));
    });
    expect(toggle).not.toHaveBeenCalled();

    view.rerender({ isFolded: false, toggle });
    act(() => {
      window.dispatchEvent(new CustomEvent(NAME));
    });
    expect(toggle).not.toHaveBeenCalled();
  });
});
