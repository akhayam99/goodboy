// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { U27_GIT_REVIEW_CARDS_SCENES } from './git-review-cards';

afterEach(cleanup);

describe('git and review cards scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U27_GIT_REVIEW_CARDS_SCENES)).toEqual(['git-review-cards']);
    expect(MOCK_SCENES['git-review-cards']).toBe(U27_GIT_REVIEW_CARDS_SCENES['git-review-cards']);
  });

  it('opens the check, history, conflict, file and artifact cards at once', () => {
    const Scene = U27_GIT_REVIEW_CARDS_SCENES['git-review-cards'];
    render(<Scene />);

    const cards = screen.getAllByTestId('fact-card');
    expect(cards).toHaveLength(5);
    expect(cards[0]?.textContent).toContain('Failed');
    expect(cards[0]?.textContent).not.toContain('https://');
    expect(cards[1]?.textContent).toContain('Commit 2');
    expect(cards[2]?.textContent).toContain('Conflicts in 2 files');
    expect(cards[3]?.textContent).toContain('From');
    expect(cards[4]?.textContent).toContain('2 open questions');
  });
});
