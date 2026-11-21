// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pressKey } from '../../../__tests__/helpers/pressKey';
import { useSearchKey } from '.';

type Props = {
  readonly onSearch: () => void;
};

const Field = ({ onSearch }: Props) => {
  useSearchKey({ onSearch });
  return <input aria-label="Filter" />;
};

afterEach(cleanup);

describe('useSearchKey', () => {
  it('runs the search on the slash and leaves the other list keys alone', () => {
    const onSearch = vi.fn();
    render(<Field onSearch={onSearch} />);

    const slash = pressKey({ code: 'Slash', target: document.body });
    const letter = pressKey({ code: 'KeyJ', target: document.body });
    const enter = pressKey({ code: 'Enter', target: document.body });

    expect(slash.defaultPrevented).toBe(true);
    expect(onSearch).toHaveBeenCalledOnce();
    expect(letter.defaultPrevented).toBe(false);
    expect(enter.defaultPrevented).toBe(false);
  });

  it('types the slash in a field', () => {
    const onSearch = vi.fn();
    const view = render(<Field onSearch={onSearch} />);

    const event = pressKey({ code: 'Slash', target: view.getByRole('textbox') });

    expect(event.defaultPrevented).toBe(false);
    expect(onSearch).not.toHaveBeenCalled();
  });
});
