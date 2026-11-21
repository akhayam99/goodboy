// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pressKey } from '../../../../__tests__/helpers/pressKey';
import { ScriptsFilterInput } from './ScriptsFilterInput';

afterEach(cleanup);

describe('ScriptsFilterInput', () => {
  it('takes the slash, also typed as shift and 7, and lets it type once it has the focus', () => {
    render(<ScriptsFilterInput value="" onChange={vi.fn()} />);
    const filter = screen.getByRole('searchbox', { name: 'Filter scripts' });

    const italian = pressKey({ code: 'Digit7', key: '/', shift: true, target: document.body });

    expect(italian.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(filter);
    expect(pressKey({ code: 'Slash', target: filter }).defaultPrevented).toBe(false);
  });

  it('clears the text on Escape and keeps the box', () => {
    const onChange = vi.fn();
    render(<ScriptsFilterInput value="eslint" onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Filter scripts' }), { key: 'Escape' });

    expect(onChange).toHaveBeenCalledWith('');
  });
});
