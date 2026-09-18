// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FinishedRegister } from './index';

afterEach(cleanup);

describe('FinishedRegister', () => {
  it('renders nothing while the register is empty', () => {
    const { container } = render(
      <FinishedRegister label="Finished" count={0} visible={<p>shown</p>} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('calls the toggle earlier while rows sit above it', () => {
    render(
      <FinishedRegister
        label="Finished"
        count={5}
        visible={<p>shown</p>}
        earlierCount={3}
        earlier={<p>older</p>}
      />,
    );

    expect(screen.getByText('shown')).toBeDefined();
    expect(screen.getByRole('button').textContent).toContain('earlier');
  });

  it('names the toggle after the section when nothing is shown above it', () => {
    render(
      <FinishedRegister
        label="Finished"
        count={4}
        visible={null}
        earlierCount={4}
        earlier={<p>older</p>}
      />,
    );
    const toggle = screen.getByRole('button');

    expect(toggle.textContent).toContain('finished');
    expect(toggle.textContent).not.toContain('earlier');
  });

  it('starts the toggle at the left edge of the column, with rows above it or without', () => {
    const { rerender } = render(
      <FinishedRegister
        label="Finished"
        count={5}
        visible={<p>shown</p>}
        earlierCount={3}
        earlier={<p>older</p>}
      />,
    );

    const withRows = screen.getByRole('button');
    expect(withRows.parentElement?.className).not.toContain('justify-center');
    expect(withRows.parentElement?.firstElementChild).toBe(withRows);

    rerender(
      <FinishedRegister
        label="Finished"
        count={4}
        visible={null}
        earlierCount={4}
        earlier={<p>older</p>}
      />,
    );

    const compact = screen.getByRole('button');
    expect(compact.parentElement?.className).not.toContain('justify-center');
    expect(compact.parentElement?.firstElementChild).toBe(compact);
  });

  it('keeps the count, the heading and the collapsed default with no visible rows', () => {
    render(
      <FinishedRegister
        label="Finished"
        count={4}
        visible={null}
        earlierCount={4}
        earlier={<p>older</p>}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Finished' })).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
    expect(screen.queryByText('older')).toBeNull();

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('older')).toBeDefined();
  });
});
