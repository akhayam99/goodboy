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
});
