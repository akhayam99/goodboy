// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { BoardEmpty } from './';

afterEach(cleanup);

describe('the empty board', () => {
  it('says what a session is in one sentence', () => {
    render(<BoardEmpty />);

    screen.getByRole('heading', { level: 2, name: 'No sessions yet' });
    screen.getByText('A session holds one goal, its agents and, for code, a branch.');
  });

  it('draws the five lanes in board order, each with one sentence of its own', () => {
    render(<BoardEmpty />);

    const lanes = screen.getAllByRole('group');
    expect(lanes.map((lane) => lane.getAttribute('aria-label'))).toEqual([
      'Building',
      'Running',
      'Needs you',
      'In review',
      'Done',
    ]);
    expect(lanes.map((lane) => lane.querySelectorAll('p').length)).toEqual([1, 1, 1, 1, 1]);
    const sentences = lanes.map((lane) => lane.querySelector('p')?.textContent);
    expect(new Set(sentences).size).toBe(5);
    expect(sentences[2]).toBe('Blocked until you act');
    expect(sentences[4]).toBe('Finished sessions show what shipped');
  });

  it('holds a single New session, in the first lane', () => {
    render(<BoardEmpty />);

    const buttons = screen.getAllByRole('button', { name: 'New session' });
    expect(buttons).toHaveLength(1);
    const [first] = screen.getAllByRole('group');
    within(first ?? document.body).getByRole('button', { name: 'New session' });
  });

  it('starts a new session from that button', () => {
    const onNew = vi.fn();
    window.addEventListener('goodboy:new-session', onNew);
    render(<BoardEmpty />);

    fireEvent.click(screen.getByRole('button', { name: 'New session' }));

    expect(onNew).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:new-session', onNew);
  });
});
