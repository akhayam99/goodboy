// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ModelBlock } from '../components/WorkTree/ModelBlock';
import { WORK_META_COLUMN } from '../components/WorkTree/workMetaSpec';

afterEach(cleanup);

const glyph = (key: string) => ({ key, node: <svg data-glyph={key} /> });

const lines = (container: HTMLElement): ReadonlyArray<string | null> =>
  Array.from(container.querySelectorAll('[data-routing-part]')).map((line) => line.textContent);

describe('ModelBlock', () => {
  it('stacks the model over its variant and effort', () => {
    const { container } = render(
      <ModelBlock glyphs={[glyph('anthropic')]} name="Sonnet 5.5" detail="Thinking · High" />,
    );

    expect(lines(container)).toEqual(['Sonnet 5.5', 'Thinking · High']);
  });

  it('keeps one line when there is no effort', () => {
    const { container, rerender } = render(<ModelBlock glyphs={[]} name="Sonnet 5.5" />);
    expect(lines(container)).toEqual(['Sonnet 5.5']);

    rerender(<ModelBlock glyphs={[]} name="Sonnet 5.5" detail="" />);
    expect(lines(container)).toEqual(['Sonnet 5.5']);
  });

  it('is the model column, left aligned at a fixed width', () => {
    const { container } = render(<ModelBlock glyphs={[]} name="Sonnet 5.5" />);
    const column = container.querySelector('[data-meta-column="model"]');

    expect(column?.className).toContain('w-34');
    expect(column?.className).toContain('justify-start');
    expect(WORK_META_COLUMN.model).toContain('w-34');
  });

  it('overlaps two providers by six pixels inside one glyph cell', () => {
    const { container } = render(
      <ModelBlock glyphs={[glyph('anthropic'), glyph('moonshot')]} name="2 models" />,
    );
    const lefts = Array.from(container.querySelectorAll<HTMLElement>('[data-glyph]')).map(
      (node) => node.parentElement?.style.left,
    );

    expect(lefts).toEqual(['1px', '9px']);
  });

  it('draws planned work in faint and done work in muted', () => {
    const { container, rerender } = render(<ModelBlock glyphs={[]} name="Opus 5.5" isPlanned />);
    const column = () => container.querySelector('[data-meta-column="model"]');
    expect(column()?.className).toContain('text-faint-foreground');

    rerender(<ModelBlock glyphs={[]} name="Opus 5.5" />);
    expect(column()?.className).toContain('text-muted-foreground');
  });

  it('hands the model lines to assistive tech under 640px', () => {
    const { container } = render(<ModelBlock glyphs={[]} name="Opus 5.5" />);

    expect(container.querySelector('[data-routing-part]')?.parentElement?.className).toContain(
      '@max-[640px]:sr-only',
    );
  });
});
