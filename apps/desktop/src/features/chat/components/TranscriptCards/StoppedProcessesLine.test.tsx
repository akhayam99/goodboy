// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StoppedProcessesLine } from './StoppedProcessesLine';

afterEach(cleanup);

describe('StoppedProcessesLine', () => {
  it('renders one plain line naming what the turn left running', () => {
    render(
      <StoppedProcessesLine
        stopped={[
          { pid: 4101, name: 'next-server', port: null },
          { pid: 4102, name: 'sh', port: null },
        ]}
      />,
    );

    const line = screen.getByTestId('transcript-stopped-processes');
    expect(line.textContent).toBe(
      'Stopped 2 processes this turn left running: next-server, 1 more.',
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders nothing when nothing was stopped', () => {
    render(<StoppedProcessesLine stopped={[]} />);

    expect(screen.queryByTestId('transcript-stopped-processes')).toBeNull();
  });
});
