// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import { MOCK_SCENES } from '../..';
import { U24_TOOLTIP_SHORTCUTS_SCENES } from './tooltip-shortcuts';

const FILE_NAME_START = 'settlement-reconciliation';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('tooltip shortcut scenes', () => {
  it('registers both scenes for the capture', () => {
    expect(Object.keys(U24_TOOLTIP_SHORTCUTS_SCENES).sort()).toEqual([
      'tooltip-shortcut',
      'tooltip-truncated',
    ]);
    for (const [id, scene] of Object.entries(U24_TOOLTIP_SHORTCUTS_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(scene);
    }
  });

  it('tooltip-shortcut shows the name and the keys as two nodes with no parentheses', () => {
    const Scene = U24_TOOLTIP_SHORTCUTS_SCENES['tooltip-shortcut'];
    render(<Scene />);

    const tip = screen.getByRole('tooltip');
    expect(within(tip).getByText('Ask an agent')).toBeDefined();
    expect(tip.querySelector('kbd')?.textContent).toBe(shortcutGlyphs('ask.open'));
    expect(tip.textContent).not.toContain('(');
  });

  it('tooltip-truncated shows the tooltip only on the name that is cut', () => {
    vi.useFakeTimers();
    const widths = new Map<string, number>([[FILE_NAME_START, 480]]);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return widths.get((this.textContent ?? '').slice(0, FILE_NAME_START.length)) ?? 0;
    });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(220);
    const Scene = U24_TOOLTIP_SHORTCUTS_SCENES['tooltip-truncated'];
    render(<Scene />);

    act(() => {
      vi.advanceTimersByTime(450 + 400);
    });

    expect(screen.getByRole('tooltip').textContent).toBe(
      'settlement-reconciliation-rounding.test.ts',
    );
    vi.restoreAllMocks();
  });
});
