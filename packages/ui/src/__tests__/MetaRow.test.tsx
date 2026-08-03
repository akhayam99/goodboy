// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MetaRow } from '../components/MetaRow';

afterEach(cleanup);

const separators = (root: HTMLElement) => root.querySelectorAll('[aria-hidden="true"]');

describe('MetaRow', () => {
  it('interleaves one separator between the kept facts', () => {
    const { container } = render(<MetaRow items={['3 steps', '2m', 'Last: Second']} />);

    expect(separators(container).length).toBe(2);
    expect(container.textContent).toBe('3 steps·2m·Last: Second');
  });

  it('drops nullish and false facts before separating', () => {
    const { container } = render(<MetaRow items={['3 steps', null, undefined, false, '2m']} />);

    expect(separators(container).length).toBe(1);
  });

  it('renders nothing when no fact survives', () => {
    const { container } = render(<MetaRow items={[null, undefined, false]} />);

    expect(container.firstChild).toBeNull();
  });
});
