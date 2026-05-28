// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useClickOutside } from './index';

afterEach(cleanup);

describe('useClickOutside', () => {
  it('fires onClose when mousedown lands outside the ref', () => {
    const outside = document.createElement('div');
    const inside = document.createElement('div');
    document.body.appendChild(outside);
    document.body.appendChild(inside);

    const onClose = vi.fn();
    renderHook(() => {
      const ref = useRef<HTMLDivElement>(inside as HTMLDivElement);
      useClickOutside(ref, onClose);
    });

    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onClose).toHaveBeenCalledOnce();

    document.body.removeChild(outside);
    document.body.removeChild(inside);
  });

  it('does not fire when mousedown is inside the ref', () => {
    const inside = document.createElement('div');
    document.body.appendChild(inside);

    const onClose = vi.fn();
    renderHook(() => {
      const ref = useRef<HTMLDivElement>(inside as HTMLDivElement);
      useClickOutside(ref, onClose);
    });

    inside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();

    document.body.removeChild(inside);
  });
});
