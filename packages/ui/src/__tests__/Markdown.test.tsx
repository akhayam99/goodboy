// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Markdown } from '../components/Markdown';

afterEach(cleanup);

const textOf = (markdown: string): string => {
  const { container } = render(<Markdown text={markdown} />);
  return container.textContent ?? '';
};

describe('Markdown html handling', () => {
  it('drops single-line html comments', () => {
    const out = textOf('before <!-- BUGBOT_BUG_ID: abc123 --> after');
    expect(out).toContain('before');
    expect(out).toContain('after');
    expect(out).not.toContain('BUGBOT_BUG_ID');
  });

  it('drops multi-line html comments and their inner content', () => {
    const out = textOf(
      [
        '<!-- LOCATIONS START',
        'src/app/useFlow.tsx#L221-L235',
        'LOCATIONS END -->',
        'visible',
      ].join('\n'),
    );
    expect(out).not.toContain('LOCATIONS');
    expect(out).not.toContain('useFlow.tsx');
    expect(out).toContain('visible');
  });

  it('strips raw html tags but keeps surrounding prose', () => {
    const out = textOf(
      'The flow re-upserts <div><a href="x"><picture></picture></a></div> the answer',
    );
    expect(out).toContain('The flow re-upserts');
    expect(out).toContain('the answer');
    expect(out).not.toContain('<div>');
    expect(out).not.toContain('picture');
    expect(out).not.toContain('href');
  });

  it('preserves context markers that look like tags', () => {
    const { container } = render(<Markdown text="see <<ctx-goal>> now" />);
    expect(container.textContent).toContain('goal');
    expect(container.textContent).not.toContain('<<');
  });

  it('keeps html inside fenced code blocks intact', () => {
    const out = textOf(['```tsx', 'const x = <div>hi</div>;', '```'].join('\n'));
    expect(out).toContain('<div>hi</div>');
  });

  it('keeps html inside inline code intact', () => {
    const out = textOf('use the `<Foo />` component');
    expect(out).toContain('<Foo />');
  });

  it('leaves an unterminated comment as literal text', () => {
    const out = textOf('trailing <!-- never closed');
    expect(out).toContain('<!-- never closed');
  });

  it('converts nbsp entities to spaces', () => {
    const out = textOf('a&nbsp;b');
    expect(out).toContain('a b');
  });

  it('renders a block control marker as a labeled callout, not raw text', () => {
    const { container } = render(<Markdown text="<<output>>ran the tests<</output>>" />);
    expect(container.textContent).not.toContain('<<');
    expect(container.textContent).toContain('ran the tests');
    expect(container.textContent).toContain('output');
  });
});

describe('Markdown document rhythm', () => {
  it('opens a new section at every heading', () => {
    const { container } = render(
      <Markdown text={['# One', 'body one', '## Two', 'body two'].join('\n')} />,
    );
    const root = container.firstElementChild;
    expect(root?.className).toContain('gap-5');
    expect(root?.children).toHaveLength(2);
    expect(root?.children[0]?.className).toContain('gap-2.5');
    expect(root?.children[0]?.children).toHaveLength(2);
    expect(root?.children[1]?.children).toHaveLength(2);
  });

  it('gives a rule its own section instead of a margin', () => {
    const { container } = render(<Markdown text={['before', '---', 'after'].join('\n')} />);
    const root = container.firstElementChild;
    expect(root?.children).toHaveLength(3);
    const rule = container.querySelector('[role="separator"]');
    expect(rule).not.toBeNull();
    expect(rule?.className).not.toContain('my-2');
  });

  it('sets the four mandated summary headings as eyebrows', () => {
    const { container } = render(<Markdown text="#### Problem" />);
    const heading = container.querySelector('h4');
    expect(heading?.className).toContain('uppercase');
    expect(heading?.className).toContain('tracking-eyebrow');
    expect(heading?.className).toContain('text-xs');
    expect(heading?.className).toContain('text-muted-foreground');
  });

  it('keeps inline code quiet and free of vertical padding', () => {
    const { container } = render(<Markdown text="run `packages/core/src/index.ts` now" />);
    const code = container.querySelector('code');
    expect(code?.className).toContain('bg-muted/50');
    expect(code?.className).toContain('py-0');
    expect(code?.className).toContain('text-foreground/90');
    expect(code?.className).not.toContain('break-all');
    expect(code?.className).toContain('wrap-anywhere');
  });

  it('softens the blockquote rule and lays its lines out with a gap', () => {
    const { container } = render(<Markdown text={['> one', '> two'].join('\n')} />);
    const quote = container.querySelector('blockquote');
    expect(quote?.className).toContain('border-border-soft');
    expect(quote?.className).toContain('gap-1.5');
    expect(quote?.className).not.toContain('border-border ');
  });

  it('sets table headers as eyebrows and cells at body size', () => {
    const { container } = render(
      <Markdown text={['| Name | Value |', '| --- | --- |', '| a | 1 |'].join('\n')} />,
    );
    expect(container.querySelector('th')?.className).toContain('tracking-eyebrow');
    expect(container.querySelector('th')?.className).toContain('text-2xs');
    expect(container.querySelector('td')?.className).toContain('text-sm');
  });
});

describe('Markdown lists', () => {
  it('keeps a loose list as one list instead of restarting the numbering', () => {
    const { container } = render(
      <Markdown text={['1. one', '', '2. two', '', '3. three'].join('\n')} />,
    );
    expect(container.querySelectorAll('ol')).toHaveLength(1);
    expect(container.querySelectorAll('li')).toHaveLength(3);
  });

  it('stops the list at a paragraph that follows a blank line', () => {
    const { container } = render(
      <Markdown text={['- one', '', 'a paragraph', '', '- two'].join('\n')} />,
    );
    expect(container.querySelectorAll('ul')).toHaveLength(2);
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });

  it('nests an indented item under its parent', () => {
    const { container } = render(
      <Markdown text={['- parent', '  - child', '  - sibling', '- second'].join('\n')} />,
    );
    const lists = container.querySelectorAll('ul');
    expect(lists).toHaveLength(2);
    const nested = lists[1];
    expect(nested?.className).toContain('marker:text-muted-foreground/70');
    expect(nested?.querySelectorAll('li')).toHaveLength(2);
    expect(lists[0]?.children).toHaveLength(2);
    expect(container.textContent).toContain('child');
    expect(container.textContent).toContain('second');
  });

  it('nests an ordered list under an unordered parent', () => {
    const { container } = render(
      <Markdown text={['- parent', '  1. first', '  2. second'].join('\n')} />,
    );
    expect(container.querySelectorAll('ul')).toHaveLength(1);
    expect(container.querySelectorAll('ol')).toHaveLength(1);
    expect(container.querySelector('ul li ol')).not.toBeNull();
  });

  it('splits sibling lists when the marker type changes at the same indent', () => {
    const { container } = render(<Markdown text={['- one', '1. two'].join('\n')} />);
    expect(container.querySelectorAll('ul')).toHaveLength(1);
    expect(container.querySelectorAll('ol')).toHaveLength(1);
    expect(container.textContent).toContain('two');
  });

  it('keeps every item when indentation jumps back to an unseen depth', () => {
    const { container } = render(
      <Markdown text={['- a', '      - deep', '   - middle', '- b'].join('\n')} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('deep');
    expect(text).toContain('middle');
    expect(text).toContain('b');
  });
});

describe('Markdown preview variant', () => {
  it('flattens the rhythm and drops the heading size jump', () => {
    const { container } = render(<Markdown variant="preview" text={'# Title\nbody'} />);
    const root = container.firstElementChild;
    expect(root?.className).toContain('gap-1');
    expect(root?.className).not.toContain('gap-5');
    const heading = container.querySelector('h1');
    expect(heading?.className).toContain('font-semibold');
    expect(heading?.className).not.toContain('text-lg');
  });

  it('drops the inline code background', () => {
    const { container } = render(<Markdown variant="preview" text="use `foo`" />);
    const code = container.querySelector('code');
    expect(code?.className).not.toContain('bg-muted');
  });

  it('degrades a fenced block to one muted mono line', () => {
    const { container } = render(
      <Markdown
        variant="preview"
        text={['```ts', 'const a = 1;', 'const b = 2;', '```'].join('\n')}
      />,
    );
    expect(container.querySelector('pre')).toBeNull();
    expect(container.textContent).toContain('const a = 1;');
    expect(container.textContent).not.toContain('const b = 2;');
  });

  it('degrades a table to its header line', () => {
    const { container } = render(
      <Markdown
        variant="preview"
        text={['| Name | Value |', '| --- | --- |', '| a | 1 |'].join('\n')}
      />,
    );
    expect(container.querySelector('table')).toBeNull();
    expect(container.textContent).toContain('Name | Value');
  });

  it('collapses a callout to its chip plus first line', () => {
    const { container } = render(
      <Markdown variant="preview" text={'<<output>>ran the tests\nand then some<</output>>'} />,
    );
    expect(container.textContent).toContain('output');
    expect(container.textContent).toContain('ran the tests');
    expect(container.textContent).not.toContain('and then some');
  });

  it('strikes through a gfm strikethrough instead of showing the tildes', () => {
    const { container } = render(<Markdown text={'keep ~~drop this~~ keep'} />);
    expect(container.querySelector('del')?.textContent).toBe('drop this');
    expect(container.textContent).not.toContain('~~');
  });

  it('leaves a lone tilde alone', () => {
    expect(textOf('about ~5 minutes')).toContain('about ~5 minutes');
  });

  it('tightens list spacing', () => {
    const { container } = render(<Markdown variant="preview" text={'- one\n- two'} />);
    expect(container.querySelector('ul')?.className).toContain('gap-0.5');
    expect(container.querySelector('ul')?.className).toContain('pl-4');
  });
});
