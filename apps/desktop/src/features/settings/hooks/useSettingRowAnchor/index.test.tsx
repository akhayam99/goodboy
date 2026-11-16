// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { SettingRowFocusContext } from '../../settingRowFocusContext';
import { useSettingRowAnchor } from './index';

type RowProps = {
  readonly rowKey: string;
};

const Row = ({ rowKey }: RowProps) => {
  const { ref, isHighlighted } = useSettingRowAnchor({ rowKey });
  return (
    <div ref={ref} data-testid={rowKey} data-highlighted={isHighlighted}>
      {rowKey}
    </div>
  );
};

type MountParams = {
  readonly row: string | null;
};

const scrollIntoView = vi.fn();

const mount = ({ row }: MountParams) => {
  const onShown = vi.fn();
  render(
    <SettingRowFocusContext value={{ row, onShown }}>
      <Row rowKey="theme" />
      <Row rowKey="contrast" />
    </SettingRowFocusContext>,
  );
  return { onShown };
};

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  });
});

afterEach(() => {
  vi.useRealTimers();
  scrollIntoView.mockClear();
  cleanup();
});

describe('useSettingRowAnchor', () => {
  it('scrolls to the focused row, lights it briefly and hands the focus back', () => {
    const { onShown } = mount({ row: 'theme' });

    expect(screen.getByTestId('theme').dataset.highlighted).toBe('true');
    expect(screen.getByTestId('contrast').dataset.highlighted).toBe('false');
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(onShown).toHaveBeenCalledOnce();

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.getByTestId('theme').dataset.highlighted).toBe('false');
  });

  it('leaves every row alone when no row is focused', () => {
    const { onShown } = mount({ row: null });

    expect(screen.getByTestId('theme').dataset.highlighted).toBe('false');
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(onShown).not.toHaveBeenCalled();
  });
});
