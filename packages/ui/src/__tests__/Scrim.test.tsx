// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Scrim } from '../components/Scrim';

afterEach(cleanup);

describe('Scrim', () => {
  it('hides itself from assistive tech and reports a mouse down', () => {
    const onMouseDown = vi.fn();
    render(<Scrim testId="backdrop" onMouseDown={onMouseDown} />);
    const scrim = screen.getByTestId('backdrop');

    fireEvent.mouseDown(scrim);

    expect(scrim.getAttribute('aria-hidden')).toBe('true');
    expect(onMouseDown).toHaveBeenCalledOnce();
  });
});
