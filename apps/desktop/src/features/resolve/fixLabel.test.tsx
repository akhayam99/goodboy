// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { FixOpenLine } from './components/ReviewFlow/FixOpenLine';
import { fixNotesLabel } from './notes/reviewNotesCopy';
import { fixLabel } from './reviewLaunchCopy';

afterEach(cleanup);

describe('the Fix verb', () => {
  it.each([1, 2, 9])('reads Fix %i on the Branch bar, the launch title and the notes', (count) => {
    render(<FixOpenLine count={count} onFix={vi.fn()} />);

    expect(screen.getByRole('button', { name: `Fix ${count}` })).toBeDefined();
    expect(fixLabel({ count })).toBe(`Fix ${count}`);
    expect(fixNotesLabel({ count })).toBe(fixLabel({ count }));
  });
});
