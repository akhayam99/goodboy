// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { U27_LIMIT_CONTINUE_SCENES } from './limit-continue';

afterEach(cleanup);

describe('limit continue scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U27_LIMIT_CONTINUE_SCENES)).toEqual(['limit-continue']);
    expect(MOCK_SCENES['limit-continue']).toBe(U27_LIMIT_CONTINUE_SCENES['limit-continue']);
  });

  it('shows the stopped turn with Retry and the explicit continue button', async () => {
    const Scene = U27_LIMIT_CONTINUE_SCENES['limit-continue'];
    render(<Scene />);

    expect(screen.queryByText('The turn stopped')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeNull();
    expect(await screen.findByRole('button', { name: /^Continue at / })).not.toBeNull();
  });

  it('turns the button into a cancellable plan on the click', async () => {
    const Scene = U27_LIMIT_CONTINUE_SCENES['limit-continue'];
    render(<Scene />);

    fireEvent.click(await screen.findByRole('button', { name: /^Continue at / }));

    expect(screen.queryByText(/^Continues at .* if Goodboy stays open$/)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: /^Continue at / })).not.toBeNull();
  });
});
