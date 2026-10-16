// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U25_C01_GRID_SCENES } from './c01-grid';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(() => {
  cleanup();
});

describe('c01 grid scenes', () => {
  it('registers every state', () => {
    for (const [id, scene] of Object.entries(U25_C01_GRID_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(scene);
    }
  });

  it('selects an agent row by clicking the row itself', async () => {
    const Scene = U25_C01_GRID_SCENES['c01-grid-list'];
    render(<Scene />);
    const list = screen.getByRole('list', { name: 'Agents' });
    expect(within(list).getAllByRole('button')).toHaveLength(4);
    const implementer = within(list).getByRole('button', { name: /Implementer/ });
    const ciFixer = within(list).getByRole('button', { name: /CI fixer/ });
    expect(implementer.getAttribute('aria-current')).toBe('true');
    await userEvent.click(ciFixer);
    expect(ciFixer.getAttribute('aria-current')).toBe('true');
    expect(implementer.getAttribute('aria-current')).toBeNull();
  });

  it('shows groups with their counts', () => {
    const Scene = U25_C01_GRID_SCENES['c01-grid-groups'];
    render(<Scene />);
    within(screen.getByRole('list', { name: 'In progress' })).getByText('HBL-412');
    within(screen.getByRole('list', { name: 'Todo' })).getByText('NWD-77');
    screen.getByText('14');
  });

  it('names every dot state', () => {
    const Scene = U25_C01_GRID_SCENES['c01-grid-dots'];
    render(<Scene />);
    for (const name of ['Something runs', 'Needs you', 'Failed', 'Unread', 'Done', 'Not started']) {
      screen.getByRole('img', { name });
    }
  });

  it('reads the specimen in two sizes', () => {
    const Scene = U25_C01_GRID_SCENES['c01-grid-type'];
    render(<Scene />);
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('text-lead');
    expect(screen.getByRole('list', { name: 'Agents' }).className).toContain('text-ui');
  });
});
