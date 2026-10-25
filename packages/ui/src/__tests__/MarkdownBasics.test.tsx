// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Markdown } from '../components/Markdown';

afterEach(cleanup);

describe('Markdown base cases', () => {
  it('sets a heading as its own element', () => {
    const { container } = render(<Markdown text="## Harborline rollout" />);
    expect(container.querySelector('h2')?.textContent).toBe('Harborline rollout');
  });

  it('sets bold and italic runs inside a paragraph', () => {
    const { container } = render(<Markdown text="ship **payments-api** and *notify-relay* now" />);
    expect(container.querySelector('strong')?.textContent).toBe('payments-api');
    expect(container.querySelector('em')?.textContent).toBe('notify-relay');
  });

  it('renders a link that opens outside the app with its destination kept', () => {
    const { container } = render(
      <Markdown text="see [Northwind](https://example.com/northwind)" />,
    );
    const link = container.querySelector('a');
    expect(link?.textContent).toBe('Northwind');
    expect(link?.getAttribute('href')).toBe('https://example.com/northwind');
    expect(link?.getAttribute('target')).toBe('_blank');
  });

  it('keeps a mailto destination as plain text, since the app opens web links only', () => {
    const { container } = render(<Markdown text="write [Acme](mailto:ops@acme.example)" />);
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('Acme');
  });

  it('keeps a fenced block verbatim', () => {
    const { container } = render(
      <Markdown text={['```', 'ledger-core --run', '```'].join('\n')} />,
    );
    expect(container.textContent).toContain('ledger-core --run');
  });

  it('renders a bullet list as one list with its items', () => {
    const { container } = render(<Markdown text={['- Acme', '- Cascadia'].join('\n')} />);
    expect(container.querySelectorAll('ul').length).toBe(1);
    expect(container.querySelectorAll('li').length).toBe(2);
  });

  it('renders a callout nested in a callout as two callouts', () => {
    const { container } = render(
      <Markdown text={['<<goal>>', '<<note>>inner<</note>>', '<</goal>>'].join('\n')} />,
    );
    expect(container.querySelectorAll('[data-block="callout"]').length).toBe(2);
  });

  it('keeps an empty document empty', () => {
    const { container } = render(<Markdown text="" />);
    expect(container.textContent).toBe('');
  });
});
