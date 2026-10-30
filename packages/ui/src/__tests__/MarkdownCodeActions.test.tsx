// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Markdown } from '../components/Markdown';
import {
  CodeBlockActionsContext,
  type CodeBlockActionsProps,
} from '../components/Markdown/codeBlockActions';

afterEach(cleanup);

const Actions = ({ content, lang }: CodeBlockActionsProps) => (
  <button type="button">{`actions for ${lang ?? 'plain'}: ${content}`}</button>
);

const TEXT = 'Run this:\n\n```bash\npnpm migrate:up\n```\n\nThen this:\n\n```\nretries = 3\n```';

describe('Markdown code block header', () => {
  it('keeps a block without actions free of buttons, so it can sit inside a button', () => {
    const { container } = render(<Markdown text={TEXT} />);
    expect(container.querySelectorAll('pre')).toHaveLength(2);
    const langs = [...container.querySelectorAll('[data-slot="code-block-lang"]')];
    expect(langs.map((lang) => lang.textContent)).toEqual(['bash', '']);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('gives each closed code block the provided actions with its text and language', () => {
    render(
      <CodeBlockActionsContext.Provider value={Actions}>
        <Markdown text={TEXT} />
      </CodeBlockActionsContext.Provider>,
    );
    screen.getByRole('button', { name: 'actions for bash: pnpm migrate:up' });
    screen.getByRole('button', { name: 'actions for plain: retries = 3' });
  });

  it('waits for the block to close before offering Wrap and the actions', () => {
    const { container } = render(
      <CodeBlockActionsContext.Provider value={Actions}>
        <Markdown text={'Run this:\n\n```bash\npnpm migrate'} />
      </CodeBlockActionsContext.Provider>,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('[data-slot="code-block-lang"]')?.textContent).toBe('bash');
  });

  it('keeps the header on the block, above the code, at rest and not only on hover', () => {
    const { container } = render(
      <CodeBlockActionsContext.Provider value={Actions}>
        <Markdown text={TEXT} />
      </CodeBlockActionsContext.Provider>,
    );
    const block = container.querySelector('[data-block="code"]');
    const header = block?.firstElementChild;
    expect(header?.getAttribute('data-slot')).toBe('code-block-header');
    expect(header?.className).not.toContain('opacity-0');
    expect(header?.nextElementSibling?.querySelector('pre')).not.toBeNull();
    expect(block?.className).toContain('bg-muted');
    expect(
      header?.querySelector('[data-slot="code-block-actions"]')?.querySelectorAll('button'),
    ).toHaveLength(2);
  });

  it('draws the code at the 13px role and lets a long line scroll until Wrap is on', () => {
    const { container } = render(
      <CodeBlockActionsContext.Provider value={Actions}>
        <Markdown text={'```ts\nconst a = 1;\n```'} />
      </CodeBlockActionsContext.Provider>,
    );
    const pre = container.querySelector('pre');
    expect(pre?.className).toContain('text-ui');
    expect(pre?.className).toContain('font-mono');
    expect(pre?.className).not.toContain('whitespace-pre-wrap');
    const wrap = screen.getByRole('button', { name: 'Wrap' });
    expect(wrap.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(wrap);
    expect(wrap.getAttribute('aria-pressed')).toBe('true');
    expect(pre?.className).toContain('whitespace-pre-wrap');
    fireEvent.click(wrap);
    expect(pre?.className).not.toContain('whitespace-pre-wrap');
  });

  it('wraps one block without wrapping the next', () => {
    const { container } = render(
      <CodeBlockActionsContext.Provider value={Actions}>
        <Markdown text={TEXT} />
      </CodeBlockActionsContext.Provider>,
    );
    const [first] = screen.getAllByRole('button', { name: 'Wrap' });
    if (first === undefined) {
      throw new Error('The first Wrap button is missing.');
    }
    fireEvent.click(first);
    const pres = container.querySelectorAll('pre');
    expect(pres[0]?.className).toContain('whitespace-pre-wrap');
    expect(pres[1]?.className).not.toContain('whitespace-pre-wrap');
  });
});
