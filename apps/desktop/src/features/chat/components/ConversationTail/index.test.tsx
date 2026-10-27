// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConversationTail } from './index';

afterEach(cleanup);

describe('ConversationTail', () => {
  it('shows the phrase it is given and a Stop', () => {
    const onStop = vi.fn();
    render(<ConversationTail phrase="Running pnpm in payments-api" onStop={onStop} />);

    screen.getByText('Running pnpm in payments-api');
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('says Stopping and busies the Stop while the process exits', () => {
    const { container } = render(
      <ConversationTail phrase="Running pnpm" onStop={vi.fn()} stopPhase="stopping" />,
    );

    screen.getByText('Stopping');
    expect(container.querySelector('[data-tail-state="stopping"]')).not.toBeNull();
    const stop = screen.getByRole('button', { name: 'Stop' });
    expect(stop.hasAttribute('disabled')).toBe(true);
    expect(stop.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByText('Running pnpm')).toBeNull();
  });

  it('says Still stopping with a Force stop that asks again', () => {
    const onStop = vi.fn();
    render(<ConversationTail phrase="Running pnpm" onStop={onStop} stopPhase="stalled" />);

    screen.getByText('Still stopping');
    fireEvent.click(screen.getByRole('button', { name: 'Force stop' }));
    expect(onStop).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('keeps the step label a run gives the Stop', () => {
    render(<ConversationTail phrase="Thinking" onStop={vi.fn()} stopLabel="Stop step" />);

    screen.getByRole('button', { name: 'Stop step' });
  });

  it('reads Waiting for a subagent only while the model has nothing to show', () => {
    const { rerender } = render(
      <ConversationTail phrase="Thinking" onStop={vi.fn()} waitingFor="Tester" />,
    );
    screen.getByText('Waiting for Tester');

    rerender(<ConversationTail phrase="Reading webhook.ts" onStop={vi.fn()} waitingFor="Tester" />);
    screen.getByText('Reading webhook.ts');
  });
});
