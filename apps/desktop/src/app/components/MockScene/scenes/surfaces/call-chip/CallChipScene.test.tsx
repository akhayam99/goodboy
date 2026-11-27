// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CALL_CHIP_SCENES } from './CallChipScene';

afterEach(cleanup);

describe('the call chip scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(CALL_CHIP_SCENES).sort()).toEqual([
      'call-chip-after',
      'call-chip-countdown',
      'call-chip-in-call',
      'call-chip-soon',
    ]);
  });

  it('shows who waits five minutes before and the seconds one minute before', () => {
    render(CALL_CHIP_SCENES['call-chip-soon']());
    screen.getByText('Before the call · 2 need you');
    cleanup();
    render(CALL_CHIP_SCENES['call-chip-countdown']());
    screen.getByText('in 42s');
    screen.getByRole('button', { name: 'Remind me in 5m' });
  });

  it('offers Return to call in the call and Open after it', () => {
    render(CALL_CHIP_SCENES['call-chip-in-call']());
    screen.getByRole('button', { name: 'Return to call' });
    cleanup();
    render(CALL_CHIP_SCENES['call-chip-after']());
    screen.getByText('While you were in the call');
    expect(screen.getAllByRole('button', { name: /^Open / })).toHaveLength(1);
  });
});
