import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Copy } from 'lucide-react';
import { queryTooltipTextOf, tooltipTextOf } from '../../../__tests__/helpers/tooltip';
import { MessageAction } from './MessageAction';

describe('MessageAction', () => {
  afterEach(cleanup);

  it('shows no tooltip when it has only its own label to say', () => {
    render(<MessageAction icon={Copy} label="Copy" tooltip={null} onRun={vi.fn()} />);

    expect(
      queryTooltipTextOf({ element: screen.getByRole('button', { name: 'Copy' }) }),
    ).toBeNull();
  });

  it('shows the reason it was given', () => {
    render(
      <MessageAction icon={Copy} label="Copy" tooltip="Nothing to copy yet" onRun={vi.fn()} />,
    );

    expect(tooltipTextOf({ element: screen.getByRole('button', { name: 'Copy' }) })).toBe(
      'Nothing to copy yet',
    );
  });
});
