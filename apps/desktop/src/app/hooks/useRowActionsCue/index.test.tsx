// @vitest-environment happy-dom
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';
import { useRowActionsCue } from './index';

const Lists = () => {
  useRowActionsCue();
  return (
    <div>
      <ul aria-label="Commits">
        <li className="group/row" data-testid="first-row">
          <span>b2c3d4e</span>
          <span className="row-actions">
            <button type="button">More</button>
          </span>
        </li>
        <li className="group/row">
          <span>a1b2c3d</span>
          <span className="row-actions">
            <button type="button">More</button>
          </span>
        </li>
      </ul>
      <ul aria-label="Notes">
        <li className="group/row" data-testid="plain-row">
          <span>No verbs here</span>
        </li>
      </ul>
      <p data-testid="outside">outside</p>
    </div>
  );
};

const commits = () => screen.getByRole('list', { name: 'Commits' });

const ROW_ACTIONS_CUE_ATTRIBUTE = 'data-row-actions-cue';

const isCued = (element: HTMLElement): boolean => element.hasAttribute(ROW_ACTIONS_CUE_ATTRIBUTE);

beforeEach(() => {
  localStorage.clear();
});

afterEach(cleanup);

describe('the first pointer entry into a list of rows', () => {
  it('shows the action cells of every row of that list while the pointer is inside', () => {
    render(<Lists />);

    fireEvent.pointerOver(screen.getByTestId('first-row'), { pointerType: 'mouse' });

    expect(commits().getAttribute(ROW_ACTIONS_CUE_ATTRIBUTE)).toBe('true');
    expect(isCued(screen.getByRole('list', { name: 'Notes' }))).toBe(false);
  });

  it('ends when the pointer leaves the list and is never shown again', () => {
    const { unmount } = render(<Lists />);
    fireEvent.pointerOver(screen.getByTestId('first-row'), { pointerType: 'mouse' });

    fireEvent.pointerLeave(commits(), { pointerType: 'mouse' });

    expect(isCued(commits())).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.rowActionsCue)).toBe('1');
    fireEvent.pointerOver(screen.getByTestId('first-row'), { pointerType: 'mouse' });
    expect(isCued(commits())).toBe(false);
    unmount();
    render(<Lists />);
    fireEvent.pointerOver(screen.getByTestId('first-row'), { pointerType: 'mouse' });
    expect(isCued(commits())).toBe(false);
  });

  it('leaves a row with no action cell, a touch and the space outside the lists alone', () => {
    render(<Lists />);

    fireEvent.pointerOver(screen.getByTestId('plain-row'), { pointerType: 'mouse' });
    fireEvent.pointerOver(screen.getByTestId('first-row'), { pointerType: 'touch' });
    fireEvent.pointerOver(screen.getByTestId('outside'), { pointerType: 'mouse' });

    expect(document.querySelector(`[${ROW_ACTIONS_CUE_ATTRIBUTE}]`)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.rowActionsCue)).toBeNull();
  });

  it('draws nothing when the cue was seen before', () => {
    localStorage.setItem(STORAGE_KEYS.rowActionsCue, '1');
    render(<Lists />);

    fireEvent.pointerOver(screen.getByTestId('first-row'), { pointerType: 'mouse' });

    expect(isCued(commits())).toBe(false);
  });

  it('is what the row-actions style reveals', () => {
    const css = readFileSync(join(__dirname, '..', '..', '..', 'styles.css'), 'utf8');
    const block = /@utility row-actions \{[\s\S]*?\n\}/.exec(css)?.[0] ?? '';

    expect(block).toContain(`:where([${ROW_ACTIONS_CUE_ATTRIBUTE}]) &`);
  });
});
