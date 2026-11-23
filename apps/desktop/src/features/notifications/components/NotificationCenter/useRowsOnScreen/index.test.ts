import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  installFakeIntersectionObserver,
  type FakeIntersectionObserver,
} from '../../../../../__tests__/helpers/fakeIntersectionObserver';
import { useRowsOnScreen } from '.';

describe('useRowsOnScreen', () => {
  let screenObserver: FakeIntersectionObserver;

  beforeEach(() => {
    screenObserver = installFakeIntersectionObserver();
  });

  afterEach(() => {
    screenObserver.restore();
  });

  it('tracks rows that mount after the popover opened, as when their code loads late', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    const rootRef = { current: root };
    const { result } = renderHook(() =>
      useRowsOnScreen({ rootRef, isActive: true, keys: ['harborline'] }),
    );

    const row = document.createElement('div');
    row.setAttribute('data-notification-key', 'harborline');
    await act(async () => {
      root.append(row);
      await Promise.resolve();
    });
    screenObserver.show({ attribute: 'data-notification-key', keys: ['harborline'] });

    expect([...result.current.keys]).toEqual(['harborline']);
    root.remove();
  });
});
