// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Plus } from 'lucide-react';
import { IconButton } from '../components/IconButton';
import { ICON_SIZE, ICON_STROKE, iconStrokeOf } from '../iconSize';

afterEach(cleanup);

describe('iconStrokeOf', () => {
  it('gives each rung of the icon ladder its one stroke', () => {
    expect(iconStrokeOf({ size: ICON_SIZE.mark })).toBe(ICON_STROKE.mark);
    expect(iconStrokeOf({ size: ICON_SIZE.row })).toBe(ICON_STROKE.row);
    expect(iconStrokeOf({ size: ICON_SIZE.control })).toBe(ICON_STROKE.control);
    expect(iconStrokeOf({ size: ICON_SIZE.notice })).toBe(ICON_STROKE.notice);
    expect(iconStrokeOf({ size: ICON_SIZE.hero })).toBe(ICON_STROKE.hero);
  });

  it('draws an icon button glyph with the stroke of its size', () => {
    const { container } = render(<IconButton icon={Plus} label="New chat" size="md" />);
    expect(container.querySelector('svg')?.getAttribute('stroke-width')).toBe(
      String(ICON_STROKE.control),
    );
  });
});
