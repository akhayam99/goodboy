// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U25_C01_TAIL_SCENES } from './c01-tail';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(() => {
  cleanup();
});

describe('c01 tail scenes', () => {
  it('registers every state', () => {
    for (const [id, scene] of Object.entries(U25_C01_TAIL_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(scene);
    }
  });

  it('puts the working phrase last with its clock from the turn start', () => {
    const Scene = U25_C01_TAIL_SCENES['c01-tail-working'];
    render(<Scene />);
    screen.getByText('Running pnpm in payments-api');
    screen.getByText(/^\d+[hms]( \d+[ms])?$/);
    screen.getByRole('button', { name: 'Stop' });
  });

  it('offers Raise limit first when paused', async () => {
    const Scene = U25_C01_TAIL_SCENES['c01-tail-paused'];
    render(<Scene />);
    await userEvent.click(screen.getByRole('button', { name: 'Raise limit' }));
    screen.getByText('Pressed raiseLimit');
  });

  it('offers Retry through Auto, never Continue, for a stopped Auto child', () => {
    const Scene = U25_C01_TAIL_SCENES['c01-tail-childstopped'];
    render(<Scene />);
    screen.getByRole('button', { name: 'Retry through Auto' });
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('keeps the reason and Retry in the pressed row after a failed close', () => {
    const Scene = U25_C01_TAIL_SCENES['c01-tail-cleanup'];
    render(<Scene />);
    screen.getByText('Could not close: 2 uncommitted files.');
    screen.getByRole('button', { name: 'Retry' });
  });
});
