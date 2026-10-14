// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { Docked } from './Docked';

afterEach(cleanup);

describe('Docked', () => {
  it('renders in place when no node is given', () => {
    render(
      <div data-testid="here">
        <Docked>
          <button type="button">Start run</button>
        </Docked>
      </div>,
    );

    expect(
      within(screen.getByTestId('here')).getByRole('button', { name: 'Start run' }),
    ).toBeDefined();
  });

  it('renders nothing while the node is not mounted yet', () => {
    render(
      <Docked node={null}>
        <button type="button">Start run</button>
      </Docked>,
    );

    expect(screen.queryByRole('button', { name: 'Start run' })).toBeNull();
  });

  it('renders inside the node once it exists', () => {
    const node = document.createElement('div');
    document.body.append(node);
    render(
      <div data-testid="here">
        <Docked node={node}>
          <button type="button">Start run</button>
        </Docked>
      </div>,
    );

    expect(within(node).getByRole('button', { name: 'Start run' })).toBeDefined();
    expect(within(screen.getByTestId('here')).queryByRole('button')).toBeNull();
  });
});
