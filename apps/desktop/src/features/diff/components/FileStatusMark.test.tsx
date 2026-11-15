// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { FileStatusMark } from './FileStatusMark';

afterEach(cleanup);

describe('FileStatusMark', () => {
  it.each([
    ['added', 'Added', 'A', 'text-success'],
    ['deleted', 'Deleted', 'D', 'text-danger'],
    ['modified', 'Modified', 'M', 'text-muted-foreground'],
    ['renamed', 'Renamed', 'R', 'text-muted-foreground'],
  ] as const)('draws %s as one letter in one box with its tone', (status, word, letter, tone) => {
    render(<FileStatusMark status={status} />);
    const mark = screen.getByLabelText(word);

    expect(mark.textContent).toBe(letter);
    expect(mark.className.split(' ')).toEqual(expect.arrayContaining(['w-3', 'text-chip', tone]));
  });

  it('keeps warning for what needs you and info for what runs, never for a file status', () => {
    for (const status of ['added', 'deleted', 'modified', 'renamed'] as const) {
      const { container, unmount } = render(<FileStatusMark status={status} />);

      expect(container.innerHTML).not.toMatch(/text-(?:warning|info)/);
      unmount();
    }
  });

  it('keeps the box and drops the M letter where a list hides modified files', () => {
    render(<FileStatusMark status="modified" isModifiedHidden />);

    expect(screen.getByLabelText('Modified').textContent).toBe('');
  });
});
