// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Plus } from '../icons';
import { IconButton } from '../components/IconButton';
import { ICON_SIZE, ICON_WEIGHT, iconWeightOf } from '../iconSize';

afterEach(cleanup);

describe('iconWeightOf', () => {
  it('gives each rung of the icon ladder its one weight', () => {
    expect(iconWeightOf({ size: ICON_SIZE.mark })).toBe(ICON_WEIGHT.mark);
    expect(iconWeightOf({ size: ICON_SIZE.row })).toBe(ICON_WEIGHT.row);
    expect(iconWeightOf({ size: ICON_SIZE.control })).toBe(ICON_WEIGHT.control);
    expect(iconWeightOf({ size: ICON_SIZE.notice })).toBe(ICON_WEIGHT.notice);
    expect(iconWeightOf({ size: ICON_SIZE.hero })).toBe(ICON_WEIGHT.hero);
  });

  it('draws an icon button glyph with the weight of its size', () => {
    const button = render(<IconButton icon={Plus} label="New chat" size="md" />);
    const drawn = button.container.querySelector('svg')?.innerHTML;
    button.unmount();
    const control = render(<Plus weight={ICON_WEIGHT.control} />).container.querySelector('svg');
    const bold = render(<Plus weight="bold" />).container.querySelector('svg');
    expect(drawn).toBe(control?.innerHTML);
    expect(drawn).not.toBe(bold?.innerHTML);
  });
});
