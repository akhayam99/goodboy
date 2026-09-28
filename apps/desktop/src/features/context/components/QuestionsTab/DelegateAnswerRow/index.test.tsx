// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { QUESTION_DELEGATE_COPY } from '../../../questionDelegate';
import { DelegateAnswerRow } from '.';

vi.mock('../../../../../shared/components/RoutingPicker', () => ({
  RoutingPicker: () => <span data-testid="routing-picker" />,
}));

afterEach(cleanup);

type RowProps = ComponentProps<typeof DelegateAnswerRow>;

const renderRow = (patch: Partial<RowProps> = {}) => {
  const props: RowProps = {
    state: 'available',
    hints: '',
    routing: { provider: 'anthropic', model: 'sonnet-5', effort: 'medium' },
    connectedProviders: ['anthropic'],
    onChoose: vi.fn(),
    onCancel: vi.fn(),
    onHints: vi.fn(),
    onRouting: vi.fn(),
    ...patch,
  };
  render(<DelegateAnswerRow {...props} />);
  return props;
};

describe('DelegateAnswerRow', () => {
  it('offers delegation as a secondary action', () => {
    const props = renderRow();
    fireEvent.click(screen.getByRole('button', { name: QUESTION_DELEGATE_COPY.offer }));
    expect(props.onChoose).toHaveBeenCalledOnce();
  });

  it('shows the routing, the hints and Cancel once chosen', () => {
    const props = renderRow({ state: 'chosen' });
    screen.getByTestId('routing-picker');
    fireEvent.change(screen.getByRole('textbox', { name: 'Hints for the delegated agent' }), {
      target: { value: 'weigh the cost' },
    });
    fireEvent.click(screen.getByRole('button', { name: QUESTION_DELEGATE_COPY.cancel }));
    expect(props.onHints).toHaveBeenCalledWith('weigh the cost');
    expect(props.onCancel).toHaveBeenCalledOnce();
  });

  it('offers a retry after the delegated agent failed', () => {
    renderRow({ state: 'retry' });
    screen.getByRole('button', { name: QUESTION_DELEGATE_COPY.retry });
  });

  it('stays off with the reason when a delegate asks', () => {
    renderRow({ state: 'blocked' });
    const link = screen.getByRole('button', { name: QUESTION_DELEGATE_COPY.offer });
    expect(link.hasAttribute('disabled')).toBe(true);
    expect(link.getAttribute('title')).toBe(QUESTION_DELEGATE_COPY.blocked);
  });

  it('draws nothing while the delegated agent answers', () => {
    renderRow({ state: 'running' });
    expect(screen.queryByTestId('delegate-answer-row')).toBeNull();
  });
});
