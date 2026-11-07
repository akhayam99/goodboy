import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { tooltipTextOf } from '../../../../../__tests__/helpers/tooltip';
import { LiveStateWord } from './index';

afterEach(cleanup);

describe('LiveStateWord', () => {
  it.each(['light', 'dark'])('gives a state its documented meaning in %s', (theme) => {
    render(
      <div data-theme={theme}>
        <LiveStateWord word="Running" tone="info" />
      </div>,
    );
    const word = screen.getByText('Running');

    expect(tooltipTextOf({ element: word })).toBe('Work is happening now.');
  });

  it('keeps the section state hidden', () => {
    render(<LiveStateWord word="Running" tone="info" isSectionState />);

    expect(screen.queryByText('Running')).toBeNull();
  });
});
