// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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

describe('Markdown code block actions', () => {
  it('adds nothing around a code block when no one provides actions', () => {
    const { container } = render(<Markdown text={TEXT} />);
    expect(container.querySelectorAll('pre')).toHaveLength(2);
    expect(container.querySelectorAll('pre')[0]?.parentElement?.className).not.toContain(
      'relative',
    );
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

  it('waits for the block to close before offering actions', () => {
    render(
      <CodeBlockActionsContext.Provider value={Actions}>
        <Markdown text={'Run this:\n\n```bash\npnpm migrate'} />
      </CodeBlockActionsContext.Provider>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the actions at rest, above the block, not only on hover', () => {
    const { container } = render(
      <CodeBlockActionsContext.Provider value={Actions}>
        <Markdown text={TEXT} />
      </CodeBlockActionsContext.Provider>,
    );
    const slot = container.querySelector('[data-slot="code-block-actions"]');
    expect(slot?.className).not.toContain('opacity-0');
    expect(slot?.nextElementSibling?.tagName).toBe('PRE');
  });
});
