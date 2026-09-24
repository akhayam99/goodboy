// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { WorkMeta } from '../components/WorkTree/WorkMeta';

afterEach(cleanup);

const columnOf = (name: string): Element | null =>
  screen.getByTestId('work-meta').querySelector(`[data-meta-column="${name}"]`);

describe('WorkMeta', () => {
  it('shows only the columns it is given, so a run row keeps its title room', () => {
    render(<WorkMeta time="Step 2 of 4" cost="$0.40" />);

    expect(screen.getByTestId('work-meta').children).toHaveLength(2);
    expect(columnOf('time')?.textContent).toBe('Step 2 of 4');
    expect(columnOf('cost')?.textContent).toBe('$0.40');
  });

  it('keeps the cost column on a row with nothing spent yet', () => {
    render(<WorkMeta routing={<span data-meta-column="model">Opus 5.5</span>} />);

    expect(columnOf('time')).toBeNull();
    expect(columnOf('cost')?.textContent).toBe('');
  });

  it('draws planned work in faint and done work in muted', () => {
    const { rerender } = render(<WorkMeta isPlanned />);
    expect(screen.getByTestId('work-meta').className).toContain('text-faint-foreground');

    rerender(<WorkMeta />);
    expect(screen.getByTestId('work-meta').className).toContain('text-muted-foreground');
  });

  it('lets a step drop its cost in a narrow pane and keeps it when asked', () => {
    const { rerender } = render(<WorkMeta cost="$0.10" />);
    expect(columnOf('cost')?.className).toContain('@max-[520px]:hidden');

    rerender(<WorkMeta cost="$0.10" shouldKeepCost />);
    expect(columnOf('cost')?.className).not.toContain('@max-[520px]:hidden');
  });
});
