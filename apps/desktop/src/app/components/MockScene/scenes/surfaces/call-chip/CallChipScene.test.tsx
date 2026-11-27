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
    expect(screen.getByText('Before the call · 2 need you')).not.toBeNull();
    cleanup();
    render(CALL_CHIP_SCENES['call-chip-countdown']());
    expect(screen.getByText('in 42s')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Remind me in 5m' })).not.toBeNull();
  });

  it('offers Return to call in the call and Open after it', () => {
    render(CALL_CHIP_SCENES['call-chip-in-call']());
    expect(screen.getByRole('button', { name: 'Return to call' })).not.toBeNull();
    cleanup();
    render(CALL_CHIP_SCENES['call-chip-after']());
    expect(screen.getByText('While you were in the call')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: /^Open / })).toHaveLength(1);
  });
});
