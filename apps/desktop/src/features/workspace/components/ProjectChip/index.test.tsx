import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    Tooltip: ({
      content,
      children,
    }: {
      readonly content: string;
      readonly children: ReactElement;
    }) => <span data-tooltip={content}>{children}</span>,
  };
});

import { ProjectChip } from './index';

afterEach(cleanup);

describe('ProjectChip', () => {
  it('renders nothing without a mounted project', () => {
    const { container } = render(<ProjectChip projectNames={[]} />);
    expect(container.childElementCount).toBe(0);
  });

  it('renders one compact named chip', () => {
    render(<ProjectChip projectNames={['goodboy-desktop']} />);
    expect(screen.getByLabelText('Project: goodboy-desktop')).toBeDefined();
    expect(screen.getByText('goodboy-desktop').className).toContain('max-w-[12ch]');
  });

  it('renders one aggregate chip with all names in its tooltip', () => {
    render(<ProjectChip projectNames={['desktop', 'ui', 'types']} />);
    const chip = screen.getByText('3 projects');
    expect(chip.closest('[data-tooltip]')?.getAttribute('data-tooltip')).toBe('desktop, ui, types');
  });
});
