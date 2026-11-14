// @vitest-environment happy-dom

import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useSnapAfterFloat } from '../useSnapAfterFloat';

type Props = {
  readonly isFloating: boolean;
};

const Aside = ({ isFloating }: Props) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useSnapAfterFloat({ ref, isFloating });
  return <div ref={ref} data-testid="aside" />;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useSnapAfterFloat', () => {
  it('drops the width transition for the one frame a floating aside lands back in the flow', () => {
    const view = render(<Aside isFloating />);
    const aside = view.getByTestId('aside');
    const seen: Array<string> = [];
    vi.spyOn(aside, 'getBoundingClientRect').mockImplementation(() => {
      seen.push(aside.style.getPropertyValue('transition-property'));
      return new DOMRect();
    });

    view.rerender(<Aside isFloating={false} />);

    expect(seen).toEqual(['none']);
    expect(aside.style.getPropertyValue('transition-property')).toBe('');
  });

  it('leaves the transition alone when the aside opens or stays in the flow', () => {
    const view = render(<Aside isFloating={false} />);
    const aside = view.getByTestId('aside');
    const spy = vi.spyOn(aside, 'getBoundingClientRect');

    view.rerender(<Aside isFloating />);
    view.rerender(<Aside isFloating />);

    expect(spy).not.toHaveBeenCalled();
  });
});
